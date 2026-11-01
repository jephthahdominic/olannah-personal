import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { isDeliveryError, validateWireContext, validateWireHistory } from '@/contracts';
import { SessionClient } from '../session/sessionClient';
import { BootController } from '@/runtime/boot/bootController';
import { technicianSession } from '@/contracts/fixtures/session';
import { purgeSession } from '@/runtime/purgeSession';
import { DEFAULT_RUNTIME_CONFIG } from '@/contracts';
import { DevContextChannel, DevFaultClient, DevHistoryChannel } from './devDelivery';
import type { TestSessionId } from './deliveryTypes';

// Runs the real delivery module against the real practice server (docker compose up -d --build, server started with OLANNAH_DEV=1).
// Skipped unless PRACTICE_API_LIVE=1, so ordinary test runs never need the backend:  PRACTICE_API_LIVE=1 npx vitest run clients/delivery/live
const live = process.env.PRACTICE_API_LIVE === '1';
const BASE = process.env.PRACTICE_API_URL ?? 'http://localhost:8000';

const signedIn = () => {
  const s = new SessionClient();
  s.set({ userId: 'u', resolvedRole: 'technician', tenantId: 't', sessionToken: 'dev' });
  return s;
};
const channels = (sessionId: TestSessionId) => ({
  context: new DevContextChannel({ target: { baseUrl: BASE, sessionId }, session: signedIn() }),
  history: new DevHistoryChannel({ target: { baseUrl: BASE, sessionId }, session: signedIn() }),
});
const kind = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return isDeliveryError(e) ? e.kind : String(e);
  }
};

describe.skipIf(!live)('the delivery module against the real practice server', () => {
  const faults = new DevFaultClient({ target: { baseUrl: BASE } });
  afterEach(async () => {
    await faults.resetSourceFaults();
    await faults.resetDeliveryFault();
  });

  it.each(['s_8f2', 's_clear', 's_busy', 's_nojob', 's_unmapped'] as const)('%s: the real context validates with every zone intact, then its history loads', async (id) => {
    const { context, history } = channels(id);
    const result = validateWireContext(await context.request());
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.malformedZones).toEqual([]);
    const zone = result.context.zones.history;
    const pointer = zone.ok ? zone.zone.pointer : null;
    if (pointer === null) return; // s_nojob: no active job, nothing to load
    expect(validateWireHistory(await history.request(pointer)).kind).toBe('ok');
  });

  it('an unknown session is "role_undetermined" (404)', async () => {
    expect(await kind(new DevContextChannel({ target: { baseUrl: BASE, sessionId: 's_nobody' as TestSessionId }, session: signedIn() }).request())).toBe('role_undetermined');
  });

  it('no session is "unauthorized" (401)', async () => {
    expect(await kind(new DevContextChannel({ target: { baseUrl: BASE }, session: new SessionClient() }).request())).toBe('unauthorized');
  });

  it('an unknown history pointer is "unknown_pointer"', async () => {
    expect(await kind(channels('s_8f2').history.request('hist_nope'))).toBe('unknown_pointer');
  });

  it('a delivery slower than 10 s is "timeout" (504)', async () => {
    await faults.setDeliveryFault({ delay_seconds: 12 });
    expect(await kind(channels('s_8f2').context.request())).toBe('timeout');
  }, 20_000);

  it('a source system down makes only its zones unavailable', async () => {
    await faults.setSourceFaults({ sitedocs: 'down', xoi: 'down' });
    const result = validateWireContext(await channels('s_8f2').context.request());
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    const steps = result.context.zones.steps;
    expect(steps.ok && steps.zone.state).toBe('unavailable');
    const alerts = result.context.zones.alerts;
    expect(alerts.ok && alerts.zone.state).toBe('rendered');
  });

  it.each([
    ['bad_schema', 'schema_mismatch'],
    ['malformed_envelope', 'envelope_malformed'],
    ['malformed_zone', 'ok'],
  ] as const)('payload fault %s is caught at the boundary as %s', async (payload, expected) => {
    await faults.setDeliveryFault({ payload });
    const result = validateWireContext(await channels('s_8f2').context.request());
    expect(result.kind).toBe(expected);
    if (payload === 'malformed_zone' && result.kind === 'ok') expect(result.malformedZones.length).toBe(1);
  });
});

// The real boot machine, driven by the real delivery module, against the real server: every screen the BRD defines for a delivery.
describe.skipIf(!live)('the boot machine against the real practice server', () => {
  const faults = new DevFaultClient({ target: { baseUrl: BASE } });
  beforeEach(() => vi.useRealTimers());
  afterEach(async () => {
    await purgeSession();
    await faults.resetSourceFaults();
    await faults.resetDeliveryFault();
  });

  const bootOn = async (sessionId: TestSessionId) => {
    // The controller puts the session token into this client when the session is confirmed, and the channel reads it from the same one.
    const sessionClient = new SessionClient();
    const controller = new BootController({
      auth: {
        signIn: async () => ({ ok: true }),
        signUp: async () => ({ ok: true }),
        restoreSession: async () => ({ ...technicianSession, sessionToken: 'dev' }),
        onSessionExpired: () => () => {},
        signOut: async () => {},
      },
      context: new DevContextChannel({ target: { baseUrl: BASE, sessionId }, session: sessionClient }),
      sessionClient,
      config: DEFAULT_RUNTIME_CONFIG,
    });
    controller.start();
    await new Promise((r) => setTimeout(r, 1500));
    return controller.getState();
  };

  it.each([
    ['s_8f2', 'technician', false],
    ['s_busy', 'technician', false],
    ['s_clear', 'technician', false],
    ['s_nojob', 'technician', false],
    ['s_unmapped', 'default', true],
  ] as const)('%s settles on the %s layout (unmapped role: %s)', async (id, layoutId, unmapped) => {
    const state = await bootOn(id);
    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') expect(state.layout).toMatchObject({ layoutId, unmappedRole: unmapped });
  });

  it('an unknown session shows the fallback screen for an undetermined role (404)', async () => {
    expect((await bootOn('s_nobody' as TestSessionId)).phase).toBe('fallbackUnknownRole');
  });

  it('a bad schema version shows the recovery screen', async () => {
    await faults.setDeliveryFault({ payload: 'bad_schema' });
    expect((await bootOn('s_8f2')).phase).toBe('fallbackSchema');
  });

  it('a broken envelope shows the recovery screen', async () => {
    await faults.setDeliveryFault({ payload: 'malformed_envelope' });
    expect((await bootOn('s_8f2')).phase).toBe('fallbackMalformed');
  });

  it('one broken zone still assembles the workspace, with just that zone marked', async () => {
    await faults.setDeliveryFault({ payload: 'malformed_zone' });
    const state = await bootOn('s_8f2');
    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') expect(Object.values(state.context.zones).filter((z) => !z.ok)).toHaveLength(1);
  });

  it('a slow delivery (2 s) arrives flagged and still assembles', async () => {
    await faults.setDeliveryFault({ delay_seconds: 2 });
    const sessionClient = new SessionClient();
    const controller = new BootController({
      auth: { signIn: async () => ({ ok: true }), signUp: async () => ({ ok: true }), restoreSession: async () => ({ ...technicianSession, sessionToken: 'dev' }), onSessionExpired: () => () => {}, signOut: async () => {} },
      context: new DevContextChannel({ target: { baseUrl: BASE, sessionId: 's_8f2' }, session: sessionClient }),
      sessionClient,
      config: DEFAULT_RUNTIME_CONFIG,
    });
    controller.start();
    await new Promise((r) => setTimeout(r, 3500));
    const state = controller.getState();
    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') expect(state.context.degraded_fields).toContainEqual({ field: 'delivery', reason: 'budget_exceeded' });
  }, 10_000);
});
