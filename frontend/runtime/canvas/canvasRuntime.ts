import type { RuntimeConfig, Wire } from '@/contracts';
import type { ContextChannel } from '@/clients/context/contextChannel';
import type { HistoryChannel } from '@/clients/history/historyChannel';
import type { FeedbackChannel } from '@/clients/feedback/feedbackChannel';
import { BusConnection, type SourceFactory } from '@/clients/bus/busConnection';
import type { SessionIdentity } from '@/clients/session/sessionClient';
import type { DeepReadonly } from '../freeze';
import { AssistantSession } from '../assistant/assistantSession';
import { FeedbackSubmitter } from '../feedback/feedbackSubmitter';
import { HistoryHydrator } from '../history/historyStore';
import { PersistenceManager } from '../persistence/persistenceManager';
import { registerPurgeHandler } from '../purgeSession';
import { logEvent } from '../telemetry';
import { RefreshManager } from '../updates/refreshManager';
import { UpdatePipeline } from '../updates/updatePipeline';
import { ZoneStore } from '../zones/zoneStore';

// The canvas runtime owns everything that happens AFTER the first render: the bus connection, the update pipeline, the
// refresh timers and history hydration (SDD 3.4 "canvas-runtime"). It is framework-free and fully testable. The render
// path only reads its state, never its clients (SDD 3.3).

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface CanvasRuntimeDeps {
  context: DeepReadonly<Wire.ValidatedContext>;
  session: SessionIdentity;
  config: RuntimeConfig;
  upstream: { context: ContextChannel; history: HistoryChannel; createBusSource: SourceFactory; createAssistantSource: SourceFactory; feedback: FeedbackChannel };
  /** Wraps store writes so React treats them as low priority (a transition). */
  applyBatch?: (apply: () => void) => void;
  /** True while a checkpoint is active. Updates queue and timers pause. */
  isBlocked?: () => boolean;
  /** Injectable for tests. */
  schedule?: (flush: () => void) => void;
  random?: () => number;
}

/**
 * The access revocation signal (BRD 1.0 SR25). Its format and delivery are OPEN (BRD 1.0 OQ11), so this is a DRAFT shape: a bus message
 * `{ type: 'access.revoked', message }` whose message is SUPPLIED upstream. The canvas never writes the text itself.
 */
function parseRevocation(raw: unknown): string | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || value === null) return null;
  const { type, message } = value as { type?: unknown; message?: unknown };
  return type === 'access.revoked' && typeof message === 'string' && message.trim().length > 0 && message.length <= 300 ? message : null;
}

export class CanvasRuntime {
  readonly zones = new ZoneStore();
  readonly history: HistoryHydrator;
  /** The assistant is a secondary surface with its own WebSocket. Its turn cache is render-only. */
  readonly assistant: AssistantSession;
  readonly feedback: FeedbackSubmitter;
  /** The shell decides which persistence-capable instances survive a layout change. Components never decide. */
  readonly persistence: PersistenceManager;

  #status: ConnectionStatus = 'connecting';
  #statusListeners = new Set<() => void>();
  #lost = false; // true once a connection that had been established was lost
  #pipeline: UpdatePipeline | null = null;
  #refresh: RefreshManager | null = null;
  #bus: BusConnection | null = null;
  #unregisterPurge: (() => void) | null = null;
  #moreLoading = new Set<string>();
  #moreListeners = new Set<() => void>();
  #revocation: { message: string } | null = null;
  #revocationListeners = new Set<() => void>();

  constructor(private readonly deps: CanvasRuntimeDeps) {
    // Zones are initialised synchronously from the context object, so the first render already has its data.
    this.zones.initialize(deps.context.zones);
    this.history = new HistoryHydrator(deps.upstream.history);
    this.assistant = new AssistantSession(deps.upstream.createAssistantSource, deps.config.bus, deps.random);
    this.feedback = new FeedbackSubmitter(deps.upstream.feedback);
    this.persistence = new PersistenceManager(deps.config.persistence.elected);
  }

  subscribeConnection = (listener: () => void): (() => void) => {
    this.#statusListeners.add(listener);
    return () => this.#statusListeners.delete(listener);
  };
  getConnection = (): ConnectionStatus => this.#status;

  /**
   * The worker asked for more rows of one group in a zone. The channel supplies the whole zone, which goes through the same pipeline as any update
   * (validated, marked refreshing, applied, confirmed). Resolves true when it was applied or a request is already under way, and false when it
   * could not be done, so the render layer can say so in its own words. A repeat press while one is pending is ignored.
   */
  async requestMore(zoneId: string, groupId: string): Promise<boolean> {
    const key = `${zoneId}:${groupId}`;
    if (this.#moreLoading.has(key)) return true;
    const channel = this.deps.upstream.context;
    const pipeline = this.#pipeline;
    if (!channel.requestMore || !pipeline) return false;
    this.#moreLoading.add(key);
    this.#notifyMore();
    try {
      const raw = await channel.requestMore(zoneId, groupId);
      if (!this.#pipeline) return false;
      pipeline.receiveZone(zoneId, raw);
      return true;
    } catch {
      return false;
    } finally {
      this.#moreLoading.delete(key);
      this.#notifyMore();
    }
  }
  subscribeMore = (listener: () => void): (() => void) => {
    this.#moreListeners.add(listener);
    return () => this.#moreListeners.delete(listener);
  };
  /** The keys of the requests under way, as one stable string: "zone:group|zone:group". */
  moreLoadingKeys = (): string => [...this.#moreLoading].sort().join('|');
  #notifyMore(): void {
    for (const l of [...this.#moreListeners]) l();
  }

  /** The worker's access to the screen they were on was removed. The message is supplied and stays until the worker dismisses it (SR25B). */
  subscribeRevocation = (listener: () => void): (() => void) => {
    this.#revocationListeners.add(listener);
    return () => this.#revocationListeners.delete(listener);
  };
  getRevocation = (): { message: string } | null => this.#revocation;
  revokeAccess(message: string): void {
    this.#revocation = { message };
    logEvent('access.revoked', 'info');
    for (const l of [...this.#revocationListeners]) l();
  }
  dismissRevocation(): void {
    if (!this.#revocation) return;
    this.#revocation = null;
    for (const l of [...this.#revocationListeners]) l();
  }

  /** Whether actions that write to a source system are available. Always false without a live connection (BRD 1.0 UR11D). */
  get canWrite(): boolean {
    return this.#status === 'connected';
  }

  start(): void {
    const { config, upstream, session } = this.deps;
    const pipeline = new UpdatePipeline({
      store: this.zones,
      stalenessWarnMs: config.refresh.stalenessWarnMs,
      isBlocked: this.deps.isBlocked,
      applyBatch: this.deps.applyBatch,
      schedule: this.deps.schedule,
    });
    this.#pipeline = pipeline;

    this.#refresh = new RefreshManager({
      store: this.zones,
      pipeline,
      requestContext: () => upstream.context.request(session),
      autoIntervalMs: config.refresh.autoIntervalMs,
      isBlocked: this.deps.isBlocked,
    });
    this.#refresh.start();

    this.#bus = new BusConnection(
      upstream.createBusSource,
      { ...config.bus, random: this.deps.random },
      { onEvent: (data) => this.#onBusEvent(data, pipeline), onState: (state) => this.#onBusState(state) },
    );
    this.#bus.start();

    // The second pass: history is requested only after the main workspace has rendered.
    // The pointer is opaque and handed on untouched. Null means no active job, so there is nothing to load.
    const historyZone = this.deps.context.zones.history;
    this.history.start(historyZone.ok ? historyZone.zone.pointer : null);
    this.assistant.start();

    this.#unregisterPurge?.();
    this.#unregisterPurge = registerPurgeHandler(() => this.dispose());
  }

  /** Manual retry from the "reconnection failed" banner. */
  retryConnection(): void {
    this.#bus?.retry();
  }

  /** Refresh every zone now. Also used by a zone's own "try again". */
  refreshAll(): Promise<void> {
    return this.#refresh?.refreshAll() ?? Promise.resolve();
  }

  /** The checkpoint ended: apply anything that was queued, and run any refresh that was held back. */
  resume(): void {
    this.#pipeline?.drainQueue();
    this.#refresh?.resume();
  }

  /** Stops all work. Safe to call twice, and safe to start() again afterwards (React StrictMode remounts). */
  dispose(): void {
    this.#bus?.close();
    this.#bus = null;
    this.#refresh?.dispose();
    this.#refresh = null;
    this.#pipeline?.dispose();
    this.#pipeline = null;
    this.history.dispose();
    this.assistant.dispose();
    this.feedback.reset();
    this.persistence.clear();
    this.#revocation = null;
    this.#moreLoading.clear();
    this.#unregisterPurge?.();
    this.#unregisterPurge = null;
  }

  // A revocation is acted on at once. Everything else is a zone update for the pipeline. The navigation set is never changed by a revocation
  // (SR25C): the canvas is not an authorization boundary, and the shell only takes the worker to Dashboard.
  #onBusEvent(data: unknown, pipeline: UpdatePipeline): void {
    const message = parseRevocation(data);
    if (message !== null) return this.revokeAccess(message);
    pipeline.receive(data);
  }

  #onBusState(state: ConnectionStatus): void {
    const previous = this.#status;
    this.#setStatus(state);

    if (state === 'reconnecting' && previous === 'connected') {
      // The connection was lost. Keep the last known data on screen, marked stale, and say so (BRD 1.0 error row 8).
      this.#lost = true;
      this.zones.markAllStale();
      logEvent('bus.disconnected', 'warn');
    } else if (state === 'connected' && this.#lost) {
      // Events may have been missed while we were away, so refresh every zone rather than trust resume (SDD 12.4).
      this.#lost = false;
      logEvent('bus.reconnected', 'info');
      void this.refreshAll();
    } else if (state === 'failed') {
      logEvent('bus.reconnect_failed', 'error');
    }
  }

  #setStatus(next: ConnectionStatus): void {
    if (this.#status === next) return;
    this.#status = next;
    for (const l of [...this.#statusListeners]) l();
  }
}
