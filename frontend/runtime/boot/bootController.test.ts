import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BootController } from './bootController';
import { SessionClient } from '@/clients/session/sessionClient';
import type { AuthProvider } from '@/clients/auth/authProvider';
import type { ContextChannel } from '@/clients/context/contextChannel';
import { technicianSession, estimatorSession } from '@/contracts/fixtures/session';
import { rawEstimator, rawFixture, rawTechnician } from '@/tests/wireFixtures';
import { DEFAULT_RUNTIME_CONFIG, DeliveryError, type SessionConfirmation } from '@/contracts';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';
import { purgeSession } from '../purgeSession';
import { stableStringify } from '../freeze';

// Each test is a BRD acceptance scenario (SDD 17.3 "Boot" and "Personas"), run against the real controller with fake timers.

const never = () => new Promise<never>(() => {});

function makeAuth(session: SessionConfirmation | null | 'never'): AuthProvider & { expire: () => void } {
  const listeners = new Set<() => void>();
  return {
    signIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    restoreSession: () => (session === 'never' ? never() : Promise.resolve(session)),
    onSessionExpired: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    signOut: async () => {},
    expire: () => listeners.forEach((l) => l()),
  };
}

// A payload that is an Error is a failed delivery (a DeliveryError, as the real channels reject with).
function channel(delayMs: number | 'never', payload: unknown): ContextChannel {
  return {
    request: () =>
      delayMs === 'never'
        ? never()
        : new Promise((resolve, reject) => setTimeout(() => (payload instanceof Error ? reject(payload) : resolve(structuredClone(payload))), delayMs)),
  };
}

function boot(opts: { session?: SessionConfirmation | null | 'never'; delay?: number | 'never'; payload?: unknown }) {
  const sessionClient = new SessionClient();
  const auth = makeAuth(opts.session === undefined ? technicianSession : opts.session);
  const controller = new BootController({
    auth,
    context: channel(opts.delay ?? 0, 'payload' in opts ? opts.payload : rawTechnician()),
    sessionClient,
    config: DEFAULT_RUNTIME_CONFIG,
  });
  controller.start();
  return { controller, sessionClient, auth };
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const phase = (c: BootController) => c.getState().phase;

beforeEach(() => {
  vi.useFakeTimers();
  clearTelemetryBuffer();
});
afterEach(async () => {
  await purgeSession();
  vi.useRealTimers();
});

describe('boot: session', () => {
  it('starts on the loading screen and shows no workspace before the session is confirmed', () => {
    const { controller } = boot({ session: 'never' });
    expect(controller.getState()).toEqual({ phase: 'awaitingSession', slow: false });
  });

  it('holds the loading screen when confirmation never arrives, switches to the slow message, and does not end the session', async () => {
    const { controller } = boot({ session: 'never' });
    await advance(DEFAULT_RUNTIME_CONFIG.session.slowMessageAfterMs + 1);
    expect(controller.getState()).toEqual({ phase: 'awaitingSession', slow: true });
    await advance(60_000);
    expect(phase(controller)).toBe('awaitingSession');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['session.slow']);
  });

  it('routes to sign-in when no SSO session exists', async () => {
    const { controller } = boot({ session: null });
    await advance(1);
    expect(phase(controller)).toBe('noSession');
  });

  it('keeps the session token out of the boot state', async () => {
    const { controller, sessionClient } = boot({});
    await advance(1);
    expect(sessionClient.hasSession()).toBe(true);
    expect(JSON.stringify(controller.getState())).not.toContain(technicianSession.sessionToken);
  });
});

describe('boot: context delivery', () => {
  it('assembles and settles when context arrives within the delivery budget', async () => {
    const { controller } = boot({ delay: 100 });
    await advance(150);
    const state = controller.getState();
    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') expect(state.layout).toEqual({ layoutId: 'technician', unmappedRole: false, unknownTemplate: false });
    expect(getBufferedEvents()).toEqual([]);
  });

  it('shows a recoverable degraded state at 900ms, then settles when context arrives, without ending the session', async () => {
    const { controller } = boot({ delay: 900 });
    await advance(850);
    expect(phase(controller)).toBe('contextDegraded');
    await advance(100);
    expect(phase(controller)).toBe('settled');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.delivery_degraded']);
  });

  it('shows the recovery screen at the hard timeout when context never arrives, and does not crash', async () => {
    const { controller } = boot({ delay: 'never' });
    await advance(DEFAULT_RUNTIME_CONFIG.context.hardTimeoutMs + 1);
    expect(phase(controller)).toBe('contextHardTimeout');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.delivery_degraded', 'context.hard_timeout']);
  });

  it('ignores a context that arrives after the recovery screen is showing', async () => {
    const { controller } = boot({ delay: 20_000 });
    await advance(10_001);
    expect(phase(controller)).toBe('contextHardTimeout');
    await advance(11_000);
    expect(phase(controller)).toBe('contextHardTimeout');
  });

  it('retry from the recovery screen requests delivery again and recovers', async () => {
    const sessionClient = new SessionClient();
    let calls = 0;
    const controller = new BootController({
      auth: makeAuth(technicianSession),
      sessionClient,
      config: DEFAULT_RUNTIME_CONFIG,
      context: {
        request: () => (++calls === 1 ? never() : Promise.resolve(structuredClone(rawTechnician()))),
      },
    });
    controller.start();
    await advance(10_001);
    expect(phase(controller)).toBe('contextHardTimeout');
    controller.retry();
    expect(phase(controller)).toBe('awaitingContext');
    await advance(1);
    expect(phase(controller)).toBe('settled');
  });
});

describe('boot: bad payloads never crash', () => {
  it('renders the recovery state for an unrecognized schema version and logs a version mismatch', async () => {
    const { controller } = boot({ payload: rawFixture('context.bad-schema') });
    await advance(1);
    expect(phase(controller)).toBe('fallbackSchema');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.schema_mismatch']);
  });

  const malformedEnvelopes: [string, unknown][] = [
    ['the practice API\'s own malformed envelope', rawFixture('context.malformed-envelope')],
    ['no schema version', { ...rawTechnician(), schema_version: undefined }],
    ['no layout', { ...rawTechnician(), layout_config: undefined }],
    ['a string', 'garbage'],
    ['null', null],
    ['an array', []],
  ];
  it.each(malformedEnvelopes)('renders the recovery state for malformed envelope: %s', async (_name, payload) => {
    const { controller } = boot({ payload });
    await advance(1);
    expect(phase(controller)).toBe('fallbackMalformed');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.envelope_malformed']);
  });

  it('can retry out of a schema mismatch', async () => {
    const { controller } = boot({ payload: rawFixture('context.bad-schema') });
    await advance(1);
    controller.retry();
    expect(phase(controller)).toBe('awaitingContext');
  });
});

describe('boot: personas and layout resolution', () => {
  it('loads the technician layout for a technician and the estimator layout for an estimator, from the same code', async () => {
    const tech = boot({ session: technicianSession, payload: rawTechnician() });
    await advance(1);
    const est = boot({ session: estimatorSession, payload: rawEstimator() });
    await advance(1);
    const t = tech.controller.getState();
    const e = est.controller.getState();
    expect(t.phase === 'settled' && t.layout.layoutId).toBe('technician');
    expect(e.phase === 'settled' && e.layout.layoutId).toBe('estimator');
  });

  it('uses the primary role layout only for a multi-role worker, never a hybrid', async () => {
    // The PCR resolves the primary role. A worker with several roles still gets one delivery with ONE template.
    const { controller } = boot({ payload: rawTechnician() });
    await advance(1);
    const state = controller.getState();
    expect(state.phase === 'settled' && state.layout.layoutId).toBe('technician');
  });

  it('loads the platform default layout for an unmapped role (not the fallback screen) and logs a structured event', async () => {
    const { controller } = boot({ payload: rawFixture('context.unmapped-role') });
    await advance(1);
    const state = controller.getState();
    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') expect(state.layout).toEqual({ layoutId: 'default', unmappedRole: true, unknownTemplate: false });
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['layout.unmapped_role']);
  });

  it('renders the fallback screen for an undetermined role (the delivery answers 404) and loads no layout', async () => {
    const { controller } = boot({ payload: new DeliveryError('role_undetermined') });
    await advance(1);
    expect(phase(controller)).toBe('fallbackUnknownRole');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['layout.role_undetermined']);
  });
});

describe('boot: context object is never modified', () => {
  it('is identical before and after consumption, and rejects mutation', async () => {
    const raw = rawTechnician();
    const { controller } = boot({ payload: raw });
    await advance(1);
    const state = controller.getState();
    if (state.phase !== 'settled') throw new Error('expected settled');
    // Every delivered field, and every zone, is exactly what was delivered.
    const { zones: deliveredZones, ...deliveredEnvelope } = raw;
    const { zones, ...envelope } = state.context;
    expect(stableStringify(envelope)).toBe(stableStringify(deliveredEnvelope));
    for (const [id, outcome] of Object.entries(zones)) expect(outcome.ok && stableStringify(outcome.zone), id).toBe(stableStringify(deliveredZones[id]));
    expect(Object.isFrozen(state.context)).toBe(true);
    expect(Object.isFrozen(state.context.layout_config.destinations)).toBe(true);
    expect(() => {
      (state.context.worker as { name: string }).name = 'hacker';
    }).toThrow(TypeError);
    expect(stableStringify(envelope)).toBe(stableStringify(deliveredEnvelope));
  });
});

describe('session expiry and purge', () => {
  it('shows the expired state, drops the token, and keeps nothing from the session', async () => {
    const { controller, sessionClient, auth } = boot({});
    await advance(1);
    expect(phase(controller)).toBe('settled');
    auth.expire();
    await advance(1);
    expect(phase(controller)).toBe('sessionExpired');
    expect(sessionClient.hasSession()).toBe(false);
    expect(getBufferedEvents()).toEqual([]);
  });

  it('purgeSession is the single exit path: it clears the token and cancels pending timers', async () => {
    const { controller, sessionClient } = boot({ delay: 'never' });
    await advance(10);
    expect(sessionClient.hasSession()).toBe(true);
    await purgeSession();
    expect(sessionClient.hasSession()).toBe(false);
    await advance(60_000);
    expect(phase(controller)).toBe('awaitingContext');
  });
});

describe('boot: each way the delivery can end (BRD section 6; practice API handoff section 8)', () => {
  it('a 401 keeps the worker on the loading screen: the workspace is never rendered before login is confirmed (UR1)', async () => {
    const { controller } = boot({ payload: new DeliveryError('unauthorized') });
    await advance(1);
    expect(controller.getState()).toEqual({ phase: 'awaitingSession', slow: true });
    await advance(60_000); // no timer fires into it
    expect(phase(controller)).toBe('awaitingSession');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.unauthorized']);
  });

  it('a 504 is the hard timeout: the recovery screen at once, and one structured event', async () => {
    const { controller } = boot({ payload: new DeliveryError('timeout') });
    await advance(1);
    expect(phase(controller)).toBe('contextHardTimeout');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.hard_timeout']);
    await advance(20_000); // the timers were cleared, so nothing is logged twice
    expect(getBufferedEvents()).toHaveLength(1);
  });

  it.each(['unreachable', 'server_error'] as const)('a "%s" failure has no screen of its own: the waiting states end it at the recovery screen', async (kind) => {
    const { controller } = boot({ payload: new DeliveryError(kind) });
    await advance(1);
    expect(phase(controller)).toBe('awaitingContext');
    await advance(DEFAULT_RUNTIME_CONFIG.context.hardTimeoutMs + 1);
    expect(phase(controller)).toBe('contextHardTimeout');
  });

  it('a delivery that arrives over the 800 ms budget carries the PCR flag, and the degraded delivery is recorded (UR10B)', async () => {
    const { controller } = boot({ payload: rawFixture('context.over-budget') });
    await advance(1);
    expect(phase(controller)).toBe('settled');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.delivery_degraded']);
  });

  it('a malformed zone degrades only that zone: the workspace assembles, and one event is logged per bad zone (SR21A)', async () => {
    const { controller } = boot({ payload: rawFixture('context.malformed-zone') });
    await advance(1);
    const state = controller.getState();
    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.context.zones.alerts.ok).toBe(false);
      expect(state.context.zones.steps.ok).toBe(true);
    }
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['zone.payload_malformed']);
  });

  it('an unknown template with NO unmapped flag is not reported as an unmapped role (UR3C: never inferred)', async () => {
    const raw = rawTechnician();
    (raw.layout_config as { template_id: string }).template_id = 'something.new';
    const { controller } = boot({ payload: raw });
    await advance(1);
    const state = controller.getState();
    if (state.phase !== 'settled') throw new Error('expected settled');
    expect(state.layout).toEqual({ layoutId: 'default', unmappedRole: false, unknownTemplate: true });
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['layout.unknown_template']);
  });

  it.each([
    'context.happy',
    'context.clear',
    'context.busy',
    'context.no-active-job',
    'context.sitedocs-down',
    'context.sitedocs-and-xoi-down',
    'context.busy-xoi-down',
    'context.portal-login-wall',
    'context.sampro-down',
  ])('%s assembles and settles', async (file) => {
    const { controller } = boot({ payload: rawFixture(file) });
    await advance(1);
    expect(phase(controller)).toBe('settled');
  });
});
