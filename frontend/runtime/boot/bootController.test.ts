import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BootController } from './bootController';
import { SessionClient } from '@/clients/session/sessionClient';
import type { AuthProvider } from '@/clients/auth/authProvider';
import type { ContextChannel } from '@/clients/context/contextChannel';
import { technicianSession, estimatorSession } from '@/contracts/fixtures/session';
import {
  technicianContext,
  estimatorContext,
  unmappedRoleContext,
  undeterminedRoleContext,
  unknownVersionContext,
  malformedContexts,
} from '@/contracts/fixtures/context';
import { DEFAULT_RUNTIME_CONFIG, type SessionConfirmation } from '@/contracts';
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

function channel(delayMs: number | 'never', payload: unknown): ContextChannel {
  return {
    request: () =>
      delayMs === 'never' ? never() : new Promise((resolve) => setTimeout(() => resolve(structuredClone(payload)), delayMs)),
  };
}

function boot(opts: { session?: SessionConfirmation | null | 'never'; delay?: number | 'never'; payload?: unknown }) {
  const sessionClient = new SessionClient();
  const auth = makeAuth(opts.session === undefined ? technicianSession : opts.session);
  const controller = new BootController({
    auth,
    context: channel(opts.delay ?? 0, 'payload' in opts ? opts.payload : technicianContext),
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
    if (state.phase === 'settled') expect(state.layout).toEqual({ layoutId: 'technician', unmappedRole: false });
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
        request: () => (++calls === 1 ? never() : Promise.resolve(structuredClone(technicianContext))),
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
    const { controller } = boot({ payload: unknownVersionContext });
    await advance(1);
    expect(phase(controller)).toBe('fallbackSchema');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.schema_mismatch']);
  });

  it.each(Object.entries(malformedContexts))('renders the recovery state for malformed envelope "%s"', async (_name, payload) => {
    const { controller } = boot({ payload });
    await advance(1);
    expect(phase(controller)).toBe('fallbackMalformed');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['context.envelope_malformed']);
  });

  it('can retry out of a schema mismatch', async () => {
    const { controller } = boot({ payload: unknownVersionContext });
    await advance(1);
    controller.retry();
    expect(phase(controller)).toBe('awaitingContext');
  });
});

describe('boot: personas and layout resolution', () => {
  it('loads the technician layout for a technician and the estimator layout for an estimator, from the same code', async () => {
    const tech = boot({ session: technicianSession, payload: technicianContext });
    await advance(1);
    const est = boot({ session: estimatorSession, payload: estimatorContext });
    await advance(1);
    const t = tech.controller.getState();
    const e = est.controller.getState();
    expect(t.phase === 'settled' && t.layout.layoutId).toBe('technician');
    expect(e.phase === 'settled' && e.layout.layoutId).toBe('estimator');
  });

  it('uses the primary role layout only for a multi-role worker, never a hybrid', async () => {
    const multi = { ...technicianContext, persona: { roles: ['technician', 'estimator'], primaryRole: 'technician' } };
    const { controller } = boot({ payload: multi });
    await advance(1);
    const state = controller.getState();
    expect(state.phase === 'settled' && state.layout.layoutId).toBe('technician');
  });

  it('loads the platform default layout for an unmapped role (not the fallback screen) and logs a structured event', async () => {
    const { controller } = boot({ payload: unmappedRoleContext });
    await advance(1);
    const state = controller.getState();
    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') expect(state.layout).toEqual({ layoutId: 'default', unmappedRole: true });
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['layout.unmapped_role']);
  });

  it('renders the fallback screen for an undetermined role and loads no layout', async () => {
    const { controller } = boot({ payload: undeterminedRoleContext });
    await advance(1);
    expect(phase(controller)).toBe('fallbackUnknownRole');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['layout.role_undetermined']);
  });
});

describe('boot: context object is never modified', () => {
  it('is identical before and after consumption, and rejects mutation', async () => {
    const before = stableStringify(technicianContext);
    const { controller } = boot({});
    await advance(1);
    const state = controller.getState();
    if (state.phase !== 'settled') throw new Error('expected settled');
    expect(stableStringify(state.context)).toBe(before);
    expect(Object.isFrozen(state.context)).toBe(true);
    expect(Object.isFrozen(state.context.layoutConfig.destinations)).toBe(true);
    expect(() => {
      (state.context as { resolvedRole: string | null }).resolvedRole = 'hacker';
    }).toThrow(TypeError);
    expect(stableStringify(state.context)).toBe(before);
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
