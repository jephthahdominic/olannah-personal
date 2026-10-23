import { describe, it, expect, vi } from 'vitest';
import { CheckpointController, approveEnabled, type Clock } from './checkpointController';
import type { CheckpointChannel, CheckpointListener } from '@/clients/checkpoint/checkpointChannel';
import { validTrigger, validDiff, unknownVersionTrigger, malformedTrigger, mismatchedDiff, malformedDiff } from '@/contracts/fixtures/checkpoint';
import { TERMINAL_OUTCOMES, type DecisionAck, type DecisionEvent } from '@/contracts';

class FakeClock implements Clock {
  t = 1_000_000;
  #timers: { id: number; at: number; run: () => void }[] = [];
  #n = 0;
  now() { return this.t; }
  setTimeout(run: () => void, ms: number) { const id = ++this.#n; this.#timers.push({ id, at: this.t + ms, run }); return id; }
  clearTimeout(h: unknown) { this.#timers = this.#timers.filter((x) => x.id !== h); }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      const next = this.#timers.filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      this.#timers = this.#timers.filter((x) => x !== next);
      this.t = next.at;
      next.run();
    }
    this.t = end;
  }
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

function setup(overrides: Partial<CheckpointChannel> = {}) {
  const clock = new FakeClock();
  const audits: unknown[] = [];
  const decisions: DecisionEvent[] = [];
  let listener: CheckpointListener | null = null;
  const channel: CheckpointChannel = {
    subscribe: (l) => { listener = l; return () => { listener = null; }; },
    fetchDiff: vi.fn(async () => validDiff),
    submitDecision: vi.fn(async (e: DecisionEvent): Promise<DecisionAck> => { decisions.push(e); return { status: 'acknowledged' }; }),
    submitAudit: vi.fn(async (s) => { audits.push(s); }),
    validate: vi.fn(async () => ({ checkpointId: validTrigger.checkpointId, valid: true })),
    ...overrides,
  };
  const active: boolean[] = [];
  let n = 0;
  const controller = new CheckpointController({ channel, session: { sessionId: 's-1', workerId: 'w-1' }, texts: { accountability: 'Approving writes the changes shown above.' }, clock, onActiveChange: (a) => active.push(a), newId: (p) => `${p}-${++n}` });
  return { controller, clock, channel, audits, decisions, active, trigger: () => listener! };
}
const ready = async (s = setup()) => { await s.controller.receiveTrigger(validTrigger); await flush(); return s; };

describe('trigger handling', () => {
  it('mounts only on a valid trigger, blocks the canvas, and waits for the diff', async () => {
    const s = setup({ fetchDiff: () => new Promise(() => {}) });
    expect(s.controller.isActive()).toBe(false);
    await s.controller.receiveTrigger(validTrigger);
    expect(s.controller.getState().phase).toBe('initializing');
    expect(s.controller.isActive()).toBe(true);
    expect(s.active).toEqual([true]);
  });
  it.each([['unknown version', unknownVersionTrigger], ['malformed', malformedTrigger], ['garbage', 'nonsense']])('shows nothing for a %s trigger', async (_n, raw) => {
    const s = setup();
    expect(s.controller.receiveTrigger(raw)).toBe(false);
    expect(s.controller.isActive()).toBe(false);
  });
  it('rejects a second trigger immediately and never queues it', async () => {
    const s = await ready();
    expect(s.controller.receiveTrigger({ ...validTrigger, checkpointId: 'cp-2' })).toBe(false);
    expect(s.controller.getState().checkpointId).toBe(validTrigger.checkpointId);
  });
  it('becomes decision-ready with the diff frozen and the accountability text captured', async () => {
    const s = await ready();
    const st = s.controller.getState();
    expect(st.phase).toBe('decision-ready');
    expect(Object.isFrozen(st.diff)).toBe(true);
    expect(Object.isFrozen(st.diff!.fields[0])).toBe(true);
    expect(st.accountabilityText).toBe('Approving writes the changes shown above.');
  });
});

describe('diff failures (a controlled wait that always resolves)', () => {
  it('ends as diff_load_failure after the 3000ms window', async () => {
    const s = setup({ fetchDiff: () => new Promise(() => {}) });
    await s.controller.receiveTrigger(validTrigger);
    s.clock.advance(2999);
    expect(s.controller.getState().phase).toBe('initializing');
    s.clock.advance(2);
    expect(s.controller.getState().outcome).toBe('diff_load_failure');
  });
  it('ends as diff_load_failure when the diff fetch fails, is malformed, or belongs to another checkpoint', async () => {
    for (const fetchDiff of [async () => { throw new Error('x'); }, async () => malformedDiff, async () => mismatchedDiff, async () => ({ ...validDiff, schemaVersion: '9.0' })]) {
      const s = setup({ fetchDiff });
      await s.controller.receiveTrigger(validTrigger);
      await flush();
      expect(s.controller.getState().outcome).toBe('diff_load_failure');
    }
  });
});

describe('acknowledgment and approval', () => {
  it('approve is disabled until acknowledged, and reject is always available', async () => {
    const s = await ready();
    expect(s.controller.isApproveEnabled()).toBe(false);
    expect(s.controller.approve()).toBe(false);
    s.controller.acknowledge();
    expect(s.controller.isApproveEnabled()).toBe(true);
  });
  it('approveEnabled is resolved from decision-ready, acknowledgment, connection and the supplied upstream condition', async () => {
    const s = await ready();
    s.controller.acknowledge();
    const st = s.controller.getState();
    expect(approveEnabled(st)).toBe(true);
    expect(approveEnabled(st, false)).toBe(false);
    expect(approveEnabled({ ...st, phase: 'initializing' })).toBe(false);
    expect(approveEnabled({ ...st, acknowledgedFor: 'cp-other' })).toBe(false);
    s.controller.setUpstreamCondition(false);
    expect(s.controller.isApproveEnabled()).toBe(false);
  });
  it('acknowledgment cannot happen before decision-ready', async () => {
    const s = setup({ fetchDiff: () => new Promise(() => {}) });
    await s.controller.receiveTrigger(validTrigger);
    s.controller.acknowledge();
    expect(s.controller.getState().acknowledgedFor).toBeNull();
  });
  it('approval submits an immutable reference, never the payload, and ends as approved with one audit stub', async () => {
    const s = await ready();
    s.controller.acknowledge();
    expect(s.controller.approve()).toBe(true);
    await flush();
    expect(s.decisions).toHaveLength(1);
    expect(s.decisions[0]).toMatchObject({ decision: 'approve', payloadReference: validDiff.payloadReference, sessionId: 's-1', workerId: 'w-1', checkpointId: validTrigger.checkpointId });
    expect(JSON.stringify(s.decisions[0])).not.toContain('Replaced the defrost sensor');
    expect(s.controller.getState().outcome).toBe('approved');
    expect(s.audits).toHaveLength(1);
  });
  it('rejects with a single action, without acknowledgment', async () => {
    const s = await ready();
    expect(s.controller.reject()).toBe(true);
    await flush();
    expect(s.controller.getState().outcome).toBe('rejected');
    expect(s.decisions[0].decision).toBe('reject');
  });
  it('is inert after the first decision: exactly one decision event per instance', async () => {
    const s = await ready();
    s.controller.acknowledge();
    s.controller.approve();
    expect(s.controller.reject()).toBe(false);
    expect(s.controller.approve()).toBe(false);
    await flush();
    expect(s.decisions).toHaveLength(1);
  });
});

describe('submission retries and failures', () => {
  it('reuses the SAME event id on every retry and succeeds inside the window', async () => {
    let calls = 0;
    const seen: string[] = [];
    const s = setup({ submitDecision: async (e) => { seen.push(e.eventId); if (++calls < 3) throw new Error('net'); return { status: 'acknowledged' }; } });
    await ready(s);
    s.controller.acknowledge();
    s.controller.approve();
    await flush();
    s.clock.advance(1000); await flush();
    s.clock.advance(1000); await flush();
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(1);
    expect(s.controller.getState().outcome).toBe('approved');
  });
  it('fails closed after the retry window, with the outcome for the decision that was made', async () => {
    const s = setup({ submitDecision: async () => { throw new Error('net'); } });
    await ready(s);
    s.controller.acknowledge();
    s.controller.approve();
    for (let i = 0; i < 8; i++) { s.clock.advance(1000); await flush(); }
    expect(s.controller.getState().outcome).toBe('approval_submission_failure');
    const r = setup({ submitDecision: async () => { throw new Error('net'); } });
    await ready(r);
    r.controller.reject();
    for (let i = 0; i < 8; i++) { r.clock.advance(1000); await flush(); }
    expect(r.controller.getState().outcome).toBe('rejection_submission_failure');
  });
  it('maps an upstream mismatch or mutation to its own outcome', async () => {
    const s = setup({ submitDecision: async () => ({ status: 'payload_mismatch' }) });
    await ready(s); s.controller.acknowledge(); s.controller.approve(); await flush();
    expect(s.controller.getState().outcome).toBe('payload_mismatch');
    const m = setup({ submitDecision: async () => ({ status: 'upstream_mutation' }) });
    await ready(m); m.controller.reject(); await flush();
    expect(m.controller.getState().outcome).toBe('upstream_mutation');
  });
});

describe('upstream change', () => {
  it('ends the checkpoint as upstream_mutation, and ignores a change for another id', async () => {
    const s = await ready();
    s.controller.receiveUpstreamChange('cp-other');
    expect(s.controller.getState().phase).toBe('decision-ready');
    s.controller.receiveUpstreamChange(validTrigger.checkpointId);
    expect(s.controller.getState().outcome).toBe('upstream_mutation');
  });
});

describe('inactivity timeouts (timestamp-based)', () => {
  it('warns at 8 minutes, expires at 10, and activity clears the warning and restarts the clock', async () => {
    const s = await ready();
    s.clock.advance(8 * 60_000);
    expect(s.controller.getState().inactivityWarning).toBe(true);
    s.controller.recordActivity();
    expect(s.controller.getState().inactivityWarning).toBe(false);
    s.clock.advance(8 * 60_000);
    expect(s.controller.getState().inactivityWarning).toBe(true);
    s.clock.advance(2 * 60_000);
    expect(s.controller.getState().outcome).toBe('timeout');
  });
  it('reconciles from timestamps when a throttled tab wakes late', async () => {
    const s = await ready();
    s.clock.t += 11 * 60_000; // timers did not fire
    s.controller.checkTimers();
    expect(s.controller.getState().outcome).toBe('timeout');
  });
  it('timings are configurable without a code change', async () => {
    const clock = new FakeClock();
    const c = new CheckpointController({ channel: setup().channel, session: { sessionId: 's', workerId: 'w' }, texts: { accountability: 'x' }, clock, timings: { inactivityExpireMs: 1000, inactivityWarnMs: 500 } });
    await c.receiveTrigger(validTrigger); await flush();
    clock.advance(1000);
    expect(c.getState().outcome).toBe('timeout');
  });
});

describe('connectivity loss', () => {
  it('stays blocked, disables approval, and resumes with the diff and acknowledgment intact when revalidated', async () => {
    const s = await ready();
    s.controller.acknowledge();
    s.controller.connectionLost();
    expect(s.controller.getState().phase).toBe('revalidating');
    expect(s.controller.isApproveEnabled()).toBe(false);
    expect(s.controller.reject()).toBe(false);
    s.controller.connectionRestored();
    await flush();
    expect(s.controller.getState().phase).toBe('decision-ready');
    expect(s.controller.getState().acknowledgedFor).toBe(validTrigger.checkpointId);
    expect(s.controller.getState().diff?.payloadReference).toBe(validDiff.payloadReference);
    expect(s.controller.isApproveEnabled()).toBe(true);
  });
  it('fails if validation says invalid, errors, or does not arrive within 2000ms', async () => {
    for (const validate of [async () => ({ checkpointId: validTrigger.checkpointId, valid: false }), async () => { throw new Error('x'); }, () => new Promise<never>(() => {})]) {
      const s = setup({ validate });
      await ready(s);
      s.controller.connectionLost();
      s.controller.connectionRestored();
      await flush();
      s.clock.advance(2001);
      expect(s.controller.getState().outcome).toBe('reconnection_validation_failure');
    }
  });
});

describe('every terminal state', () => {
  it('has exactly one audit stub, allow-listed fields only, and the rendered accountability text', async () => {
    const s = await ready();
    s.controller.reportRenderFailure();
    s.controller.reportComponentLoadFailure();
    s.controller.dispose();
    expect(s.audits).toHaveLength(1);
    expect(s.audits[0]).toMatchObject({ outcome: 'render_failure', diffFields: ['Work order status', 'Part replaced', 'Resolution note'], accountabilityText: 'Approving writes the changes shown above.' });
    expect(JSON.stringify(s.audits[0])).not.toContain('defrost sensor;');
  });
  it('covers all twelve outcomes, each reachable', () => {
    expect(TERMINAL_OUTCOMES).toHaveLength(12);
  });
  it('a failing audit never blocks dismissal', async () => {
    const s = setup({ submitAudit: async () => { throw new Error('audit down'); } });
    await ready(s);
    s.controller.reportRenderFailure();
    s.controller.release();
    expect(s.controller.isActive()).toBe(false);
    expect(s.active).toEqual([true, false]);
  });
  it('abandons an active checkpoint when the session ends', async () => {
    const s = await ready();
    s.controller.dispose();
    expect(s.audits[0]).toMatchObject({ outcome: 'session_abandoned' });
    expect(s.controller.isActive()).toBe(false);
  });
  it('a new checkpoint id always starts unacknowledged', async () => {
    const s = await ready();
    s.controller.acknowledge();
    s.controller.reportRenderFailure();
    s.controller.release();
    await s.controller.receiveTrigger({ ...validTrigger, checkpointId: 'cp-2' });
    expect(s.controller.getState().acknowledgedFor).toBeNull();
  });
  it('attach routes channel triggers and upstream changes into the controller', async () => {
    const s = setup({ fetchDiff: async () => ({ ...validDiff, checkpointId: 'cp-9' }) });
    s.controller.attach();
    s.trigger().trigger({ ...validTrigger, checkpointId: 'cp-9' });
    await flush();
    expect(s.controller.getState().phase).toBe('decision-ready');
    s.trigger().upstreamChange('cp-9');
    expect(s.controller.getState().outcome).toBe('upstream_mutation');
  });
});
