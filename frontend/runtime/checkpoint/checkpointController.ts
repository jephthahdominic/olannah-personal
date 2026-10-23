import {
  AuditStubSchema,
  CheckpointTriggerSchema,
  DEFAULT_CHECKPOINT_TIMINGS,
  DiffPayloadSchema,
  ValidationResultSchema,
  auditableFields,
  isSupportedCheckpointVersion,
  type AuditStub,
  type CheckpointTimings,
  type CheckpointTrigger,
  type Decision,
  type DecisionEvent,
  type DiffPayload,
  type TerminalOutcome,
} from '@/contracts';
import type { CheckpointChannel } from '@/clients/checkpoint/checkpointChannel';
import { newId } from '../ids';
import { logEvent } from '../telemetry';

// The single checkpoint controller: a finite state machine and the ONLY code that can start, advance or end a checkpoint
// (BRD 1.2 5.10, 1.3 8.7; SDD 11). The canvas has no logic that decides a checkpoint is needed: a checkpoint exists only
// because a well-formed trigger arrived. Invariants: fail closed, no ambiguous terminal state, render do not resolve.
//
//   idle -> initializing -> decision-ready -> submitting -> terminal -> (release) -> idle
//                                 |  ^
//                                 v  |   connection lost / restored and revalidated
//                             revalidating
//
// Every path ends in exactly ONE of the twelve terminal outcomes, with one audit stub. Decisions are idempotent: the event id
// is generated once and reused on every retry. State is presentation and orchestration only; the diff is frozen on arrival.

export type CheckpointPhase = 'idle' | 'initializing' | 'decision-ready' | 'revalidating' | 'submitting' | 'terminal';

export interface CheckpointState {
  readonly phase: CheckpointPhase;
  readonly checkpointId: string | null;
  readonly trigger: CheckpointTrigger | null;
  readonly diff: DiffPayload | null;
  /** Acknowledgment is scoped to the checkpoint INSTANCE, never the session. A new id always starts unacknowledged. */
  readonly acknowledgedFor: string | null;
  readonly decision: Decision | null;
  readonly eventId: string | null;
  readonly outcome: TerminalOutcome | null;
  /** The inactivity warning is showing. */
  readonly inactivityWarning: boolean;
  readonly connectionLost: boolean;
  /** The accountability statement as RENDERED, captured for the audit stub. */
  readonly accountabilityText: string | null;
}

const IDLE: CheckpointState = {
  phase: 'idle',
  checkpointId: null,
  trigger: null,
  diff: null,
  acknowledgedFor: null,
  decision: null,
  eventId: null,
  outcome: null,
  inactivityWarning: false,
  connectionLost: false,
  accountabilityText: null,
};

export interface Clock {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
const realClock: Clock = { now: () => Date.now(), setTimeout: (run, ms) => setTimeout(run, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export interface CheckpointControllerDeps {
  channel: CheckpointChannel;
  session: { sessionId: string; workerId: string };
  /** The fixed worker-facing texts. The accountability statement is identical for every persona and system. */
  texts: { accountability: string };
  timings?: Partial<CheckpointTimings>;
  clock?: Clock;
  /** Called when the canvas must start or stop being blocked: updates queue, timers pause, toasts are held. */
  onActiveChange?: (active: boolean) => void;
  /** Injectable for tests. */
  newId?: (prefix: string) => string;
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as object)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

/** approveEnabled is RESOLVED here and only rendered by the controls (BRD 1.2 5.10 Feature 2B). */
export const approveEnabled = (s: CheckpointState, upstreamOk = true): boolean =>
  s.phase === 'decision-ready' && s.checkpointId !== null && s.acknowledgedFor === s.checkpointId && !s.connectionLost && upstreamOk;

export class CheckpointController {
  #state: CheckpointState = IDLE;
  #listeners = new Set<() => void>();
  #timings: CheckpointTimings;
  #clock: Clock;
  #idFor: (prefix: string) => string;
  #diffTimer: unknown = null;
  #inactivityTimer: unknown = null;
  #validationTimer: unknown = null;
  #retryTimer: unknown = null;
  #lastActivityAt = 0;
  #submitStartedAt = 0;
  #upstreamOk = true;
  #unsubscribe: (() => void) | null = null;

  constructor(private readonly deps: CheckpointControllerDeps) {
    this.#timings = { ...DEFAULT_CHECKPOINT_TIMINGS, ...deps.timings };
    this.#clock = deps.clock ?? realClock;
    this.#idFor = deps.newId ?? newId;
  }

  // ---- state access -------------------------------------------------------------------------------------------------
  subscribe = (l: () => void): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getState = (): CheckpointState => this.#state;
  /** True from the trigger until the surface is released. The canvas is blocked for exactly this long. */
  isActive = (): boolean => this.#state.phase !== 'idle';
  get timings(): CheckpointTimings {
    return this.#timings;
  }
  /** A supplied upstream condition for approval (SDD 11). Defaults to ok. */
  setUpstreamCondition(ok: boolean): void {
    this.#upstreamOk = ok;
    this.#emit();
  }
  isApproveEnabled = (): boolean => approveEnabled(this.#state, this.#upstreamOk);

  /** Starts listening to the upstream channel. Returns a function that stops it. */
  attach(): () => void {
    this.#unsubscribe?.();
    this.#unsubscribe = this.deps.channel.subscribe({
      trigger: (raw) => void this.receiveTrigger(raw),
      upstreamChange: (id) => this.receiveUpstreamChange(id),
    });
    return () => {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
    };
  }

  /** Session end: an active checkpoint ends as abandoned, and everything stops. Safe to call twice. */
  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#end('session_abandoned');
    this.#clearTimers();
    if (this.#state.phase === 'terminal') this.release();
  }

  // ---- inputs -------------------------------------------------------------------------------------------------------
  /** A trigger arrived. Returns false (and shows nothing) for a second trigger or a malformed one: never queued. */
  receiveTrigger(raw: unknown): boolean {
    if (this.#state.phase !== 'idle') {
      logEvent('checkpoint.second_trigger_rejected', 'warn', 'rejected');
      return false;
    }
    const parsed = CheckpointTriggerSchema.safeParse(raw);
    if (!parsed.success || !isSupportedCheckpointVersion(parsed.data.schemaVersion)) {
      logEvent('checkpoint.protocol_error', 'error', parsed.success ? 'schema_version' : 'malformed');
      return false;
    }
    const trigger = deepFreeze(parsed.data);
    const id = trigger.checkpointId;
    this.#set({ ...IDLE, phase: 'initializing', checkpointId: id, trigger });
    this.deps.onActiveChange?.(true);
    logEvent('checkpoint.shown', 'info');
    this.#lastActivityAt = this.#clock.now();
    this.#scheduleInactivity();

    // A controlled wait: the diff resolves to a rendered diff or to an error inside the window. It never waits indefinitely.
    this.#diffTimer = this.#clock.setTimeout(() => this.#end('diff_load_failure', id), this.#timings.diffWaitMs);
    // The surface is already mounted (initializing); the diff arrives later, so this does not wait for it.
    this.deps.channel.fetchDiff(id).then(
      (raw) => this.#receiveDiff(raw, id),
      () => this.#end('diff_load_failure', id),
    );
    return true;
  }

  receiveUpstreamChange(checkpointId: string): void {
    if (this.#state.checkpointId === checkpointId) this.#end('upstream_mutation');
  }

  /** The worker completed the acknowledgment. Interactive only at decision-ready, and never carried to another id. */
  acknowledge(): void {
    const s = this.#state;
    if (s.phase !== 'decision-ready' || s.connectionLost || s.checkpointId === null) return;
    this.recordActivity();
    this.#set({ acknowledgedFor: s.checkpointId });
  }

  /** The worker approved, after the confirmation gesture. Ignored unless approval is enabled. */
  approve(): boolean {
    if (!this.isApproveEnabled()) return false;
    this.#decide('approve');
    return true;
  }

  /** Reject is always available once the checkpoint is decision-ready, with a single action. */
  reject(): boolean {
    if (this.#state.phase !== 'decision-ready') return false;
    this.#decide('reject');
    return true;
  }

  /** Pointer, keyboard, touch or scroll inside the surface. Clears the inactivity warning and restarts the windows. */
  recordActivity(): void {
    const s = this.#state;
    if (s.phase === 'idle' || s.phase === 'terminal') return;
    this.#lastActivityAt = this.#clock.now();
    if (s.inactivityWarning) this.#set({ inactivityWarning: false });
    this.#scheduleInactivity();
  }

  /** Reconciles timers from timestamps. A throttled background tab calls this when it becomes visible again. */
  checkTimers(): void {
    const s = this.#state;
    if (s.phase === 'idle' || s.phase === 'terminal') return;
    const idle = this.#clock.now() - this.#lastActivityAt;
    if (s.phase !== 'submitting' && idle >= this.#timings.inactivityExpireMs) return this.#end('timeout');
    if (!s.inactivityWarning && idle >= this.#timings.inactivityWarnMs) this.#set({ inactivityWarning: true });
    this.#scheduleInactivity();
  }

  connectionLost(): void {
    const s = this.#state;
    if (s.phase === 'idle' || s.phase === 'terminal' || s.connectionLost) return;
    // Nothing was submitted. A held, decision-ready checkpoint stays blocked until it is revalidated.
    this.#set({ connectionLost: true, phase: s.phase === 'decision-ready' ? 'revalidating' : s.phase });
  }

  connectionRestored(): void {
    const s = this.#state;
    if (!s.connectionLost) return;
    if (s.phase !== 'revalidating') return this.#set({ connectionLost: false });
    const id = s.checkpointId!;
    this.#validationTimer = this.#clock.setTimeout(() => this.#end('reconnection_validation_failure', id), this.#timings.validationMs);
    this.deps.channel.validate(id).then(
      (raw) => {
        if (this.#state.checkpointId !== id || this.#state.phase !== 'revalidating') return;
        const result = ValidationResultSchema.safeParse(raw);
        if (!result.success || !result.data.valid || result.data.checkpointId !== id) return this.#end('reconnection_validation_failure', id);
        this.#clear('#validationTimer');
        // The same immutable instance was revalidated: the diff is intact and acknowledgment is preserved.
        this.#set({ connectionLost: false, phase: 'decision-ready' });
      },
      () => this.#end('reconnection_validation_failure', id),
    );
  }

  reportRenderFailure(): void {
    this.#end('render_failure');
  }
  reportComponentLoadFailure(): void {
    this.#end('component_load_failure');
  }

  /** The shell dismissed the surface after a terminal state. Returns the canvas to normal within the same task. */
  release(): void {
    if (this.#state.phase === 'idle') return;
    this.#clearTimers();
    this.#set({ ...IDLE });
    this.deps.onActiveChange?.(false);
  }

  // ---- internals ----------------------------------------------------------------------------------------------------
  #receiveDiff(raw: unknown, id: string): void {
    if (this.#state.checkpointId !== id || this.#state.phase !== 'initializing') return;
    const parsed = DiffPayloadSchema.safeParse(raw);
    if (!parsed.success || !isSupportedCheckpointVersion(parsed.data.schemaVersion) || parsed.data.checkpointId !== id) return this.#end('diff_load_failure', id);
    this.#clear('#diffTimer');
    // Frozen on arrival: the diff never changes for the life of this checkpoint. A change upstream ends it and reissues.
    this.#set({
      phase: this.#state.connectionLost ? 'revalidating' : 'decision-ready',
      diff: deepFreeze(parsed.data),
      accountabilityText: this.deps.texts.accountability,
    });
  }

  #decide(decision: Decision): void {
    const s = this.#state;
    const eventId = s.eventId ?? this.#idFor('evt'); // generated ONCE, reused on every retry
    this.#set({ phase: 'submitting', decision, eventId });
    this.#submitStartedAt = this.#clock.now();
    const event: DecisionEvent = {
      checkpointId: s.checkpointId!,
      eventId,
      sessionId: this.deps.session.sessionId,
      workerId: this.deps.session.workerId,
      decidedAt: new Date(this.#clock.now()).toISOString(),
      decision,
      payloadReference: s.diff!.payloadReference, // an immutable reference, never the executable payload
    };
    void this.#attempt(event);
  }

  async #attempt(event: DecisionEvent): Promise<void> {
    const id = event.checkpointId;
    let ack;
    try {
      ack = await this.deps.channel.submitDecision(event);
    } catch {
      ack = null;
    }
    if (this.#state.checkpointId !== id || this.#state.phase !== 'submitting') return;
    if (ack?.status === 'acknowledged') return this.#end(event.decision === 'approve' ? 'approved' : 'rejected', id);
    if (ack?.status === 'payload_mismatch') return this.#end('payload_mismatch', id);
    if (ack?.status === 'upstream_mutation') return this.#end('upstream_mutation', id);
    const elapsed = this.#clock.now() - this.#submitStartedAt;
    if (elapsed + this.#timings.retryDelayMs < this.#timings.retryWindowMs) {
      this.#retryTimer = this.#clock.setTimeout(() => void this.#attempt(event), this.#timings.retryDelayMs);
    } else {
      this.#end(event.decision === 'approve' ? 'approval_submission_failure' : 'rejection_submission_failure', id);
    }
  }

  /** Ends the checkpoint in exactly one terminal state. A late call for an old instance, or a second call, does nothing. */
  #end(outcome: TerminalOutcome, forId?: string): void {
    const s = this.#state;
    if (s.phase === 'idle' || s.phase === 'terminal') return;
    if (forId !== undefined && s.checkpointId !== forId) return;
    this.#clearTimers();
    this.#set({ phase: 'terminal', outcome });
    logEvent(`checkpoint.${outcome}`, outcome === 'approved' || outcome === 'rejected' ? 'info' : 'warn');
    this.#audit(outcome);
  }

  #audit(outcome: TerminalOutcome): void {
    const s = this.#state;
    const stub: AuditStub = AuditStubSchema.parse({
      checkpointId: s.checkpointId,
      eventId: s.eventId,
      sessionId: this.deps.session.sessionId,
      workerId: this.deps.session.workerId,
      at: new Date(this.#clock.now()).toISOString(),
      outcome,
      diffFields: auditableFields(s.diff),
      accountabilityText: s.accountabilityText ?? this.deps.texts.accountability,
    });
    // One attempt. It never blocks dismissal, and a failure is not shown to the worker.
    this.deps.channel.submitAudit(stub).catch(() => {});
  }

  #scheduleInactivity(): void {
    this.#clear('#inactivityTimer');
    const idle = this.#clock.now() - this.#lastActivityAt;
    const next = this.#state.inactivityWarning ? this.#timings.inactivityExpireMs : this.#timings.inactivityWarnMs;
    this.#inactivityTimer = this.#clock.setTimeout(() => this.checkTimers(), Math.max(0, next - idle));
  }

  #clear(which: '#diffTimer' | '#inactivityTimer' | '#validationTimer' | '#retryTimer'): void {
    const handle = which === '#diffTimer' ? this.#diffTimer : which === '#inactivityTimer' ? this.#inactivityTimer : which === '#validationTimer' ? this.#validationTimer : this.#retryTimer;
    if (handle !== null) this.#clock.clearTimeout(handle);
    if (which === '#diffTimer') this.#diffTimer = null;
    else if (which === '#inactivityTimer') this.#inactivityTimer = null;
    else if (which === '#validationTimer') this.#validationTimer = null;
    else this.#retryTimer = null;
  }
  #clearTimers(): void {
    for (const t of ['#diffTimer', '#inactivityTimer', '#validationTimer', '#retryTimer'] as const) this.#clear(t);
  }

  #set(patch: Partial<CheckpointState>): void {
    this.#state = Object.freeze({ ...this.#state, ...patch });
    this.#emit();
  }
  #emit(): void {
    for (const l of [...this.#listeners]) l();
  }
}
