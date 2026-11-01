import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoneStore, stateFromZone, validateZoneUpdate } from './zoneStore';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';
import { rawFixture, rawTechnician, validated } from '@/tests/wireFixtures';
import { withDashboard } from '@/contracts/fixtures/dashboard';
import { withWorkOrders, workOrdersZone } from '@/contracts/fixtures/workOrders';

beforeEach(() => clearTelemetryBuffer());

const storeFor = (name: string) => {
  const s = new ZoneStore();
  s.initialize(validated(rawFixture(name)).zones);
  return s;
};

describe('ZoneStore ingestion of the delivered zones (BRD SR16A, SR21A)', () => {
  it('turns a healthy delivery into rendered zones that keep their data exactly as delivered, with how old they are', () => {
    const delivered = validated(rawTechnician());
    const s = new ZoneStore();
    s.initialize(delivered.zones);
    for (const key of ['alerts', 'work_order', 'steps', 'actions']) expect(s.get(key).condition, key).toBe('rendered');
    expect(s.get('alerts').asOf).toBe('2026-10-23T08:00:03-05:00');
    expect(s.get('work_order').asOf).toBe('2026-10-22T16:40:00-05:00');
    // The very same object: nothing was copied, reshaped or defaulted.
    expect(delivered.zones.alerts.ok && s.get('alerts').data === delivered.zones.alerts.zone.data).toBe(true);
    expect((s.get('steps').data as unknown[]).length).toBe(8);
  });

  it('shows history as rendered while a pointer exists: history owns its own loading state (BRD UR9A)', () => {
    expect(storeFor('context.happy').get('history')).toMatchObject({ condition: 'rendered' });
  });

  it('a zone that is "loading" waits for its data with a skeleton', () => {
    const raw = rawTechnician();
    (raw.zones.steps as { state: string }).state = 'loading';
    const s = new ZoneStore();
    s.initialize(validated(raw).zones);
    expect(s.get('steps').condition).toBe('scaffolded');
  });

  it('a zone that is "unavailable" is unavailable, and only that zone', () => {
    const s = storeFor('context.sitedocs-and-xoi-down');
    expect(s.get('steps').condition).toBe('unavailable');
    expect(s.get('alerts').condition).toBe('rendered');
    expect(s.get('work_order').condition).toBe('rendered');
    expect(s.get('actions').condition).toBe('rendered');
  });

  it('a rendered zone with nothing in it is an EMPTY state, not an error', () => {
    const s = storeFor('context.clear');
    expect(s.get('alerts').condition).toBe('empty');
    expect(s.get('steps').condition).toBe('empty');
    expect(getBufferedEvents()).toEqual([]);
  });

  it('with no active job, the work order is empty and there is no history to load', () => {
    const s = storeFor('context.no-active-job');
    expect(s.get('work_order').condition).toBe('empty');
    expect(s.get('history').condition).toBe('empty');
  });

  it('degrades only the malformed zone, logs one structured event, and leaves the others alone (SR21A)', () => {
    const s = storeFor('context.malformed-zone');
    expect(s.get('alerts').condition).toBe('unavailable');
    for (const key of ['work_order', 'steps', 'actions', 'history']) expect(s.get(key).condition, key).toBe('rendered');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['zone.payload_malformed']);
  });

  it('keeps no message of its own: the zone text is the registered unavailable text, never generated here', () => {
    expect(Object.keys(storeFor('context.sampro-down').get('alerts'))).not.toContain('message');
  });
});

describe('a zone delivered after the context (a bus event or a refresh)', () => {
  const good = { state: 'rendered', as_of: '2026-10-23T09:00:00-05:00', data: [] };

  it('is validated on its own: a malformed one is rejected, never applied', () => {
    expect(validateZoneUpdate('alerts', good).ok).toBe(true);
    expect(validateZoneUpdate('alerts', { state: 'stale', as_of: null, data: [] }).ok).toBe(false);
    expect(validateZoneUpdate('alerts', { state: 'rendered', as_of: null, data: 'x' }).ok).toBe(false);
    expect(validateZoneUpdate('alerts', 'garbage').ok).toBe(false);
  });

  it('an unknown zone id is rejected, not guessed at', () => {
    expect(validateZoneUpdate('parts', good).ok).toBe(false);
    expect(validateZoneUpdate('../../x', good).ok).toBe(false);
  });

  it('turns into the same condition a delivered zone would', () => {
    expect(stateFromZone('alerts', good as never).condition).toBe('empty');
    expect(stateFromZone('steps', { state: 'unavailable', as_of: null, data: [] } as never).condition).toBe('unavailable');
  });
});

describe('ZoneStore subscriptions are per zone', () => {
  it('notifies only the subscribers of the zone that changed', () => {
    const s = storeFor('context.happy');
    const a = vi.fn();
    const b = vi.fn();
    s.subscribe('alerts')(a);
    s.subscribe('steps')(b);
    s.markUnavailable('alerts');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('does not notify when nothing actually changed', () => {
    const s = storeFor('context.clear');
    const l = vi.fn();
    s.subscribe('alerts')(l);
    s.set('alerts', s.get('alerts'));
    expect(l).not.toHaveBeenCalled();
  });

  it('keeps refresh and condition as separate dimensions (a stale zone can also be refreshing)', () => {
    const s = storeFor('context.happy');
    s.set('alerts', { ...s.get('alerts'), condition: 'stale', refreshing: true });
    expect(s.get('alerts')).toMatchObject({ condition: 'stale', refreshing: true });
  });

  it('a connection loss marks only zones that show data as stale', () => {
    const s = storeFor('context.sitedocs-and-xoi-down');
    s.markAllStale();
    expect(s.get('alerts').condition).toBe('stale');
    expect(s.get('steps').condition).toBe('unavailable'); // nothing to go stale
  });
});

describe('the optional dashboard zone', () => {
  it('has no store entry when the delivery has none, which is not a failure', () => {
    const s = storeFor('context.happy');
    expect(s.keys()).not.toContain('dashboard');
    expect(getBufferedEvents()).toEqual([]);
  });

  it('is rendered with its data exactly as delivered when it is supplied', () => {
    const s = new ZoneStore();
    const delivered = validated(withDashboard(rawTechnician()));
    s.initialize(delivered.zones);
    expect(s.get('dashboard').condition).toBe('rendered');
    expect((s.get('dashboard').data as { greeting: string }).greeting).toBe('Good morning, Marcus');
  });

  it('a malformed dashboard is unavailable alone, with one event, and the other zones are untouched', () => {
    const raw = withDashboard(rawTechnician());
    (raw.zones.dashboard as { data: unknown }).data = 'nope';
    const s = new ZoneStore();
    s.initialize(validated(raw).zones);
    expect(s.get('dashboard').condition).toBe('unavailable');
    expect(s.get('alerts').condition).toBe('rendered');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['zone.payload_malformed']);
  });

  it('accepts an update for it from the bus, and rejects one that is malformed', () => {
    const delivered = withDashboard(rawTechnician());
    expect(validateZoneUpdate('dashboard', delivered.zones.dashboard).ok).toBe(true);
    expect(validateZoneUpdate('dashboard', { state: 'rendered', as_of: null, data: { greeting: 1 } }).ok).toBe(false);
  });
});

describe('the optional work orders zone', () => {
  it('has no store entry when the delivery has none, which is not a failure', () => {
    expect(storeFor('context.happy').keys()).not.toContain('work_orders');
    expect(getBufferedEvents()).toEqual([]);
  });

  it('is rendered with its data exactly as delivered, and an empty list is still a rendered zone that explains itself', () => {
    const s = new ZoneStore();
    s.initialize(validated(withWorkOrders(rawTechnician())).zones);
    expect(s.get('work_orders').condition).toBe('rendered');
    const e = new ZoneStore();
    e.initialize(validated(withWorkOrders(rawTechnician(), 'empty')).zones);
    expect(e.get('work_orders').condition).toBe('rendered');
    expect((e.get('work_orders').data as { groups: unknown[] }).groups).toEqual([]);
  });

  it('a malformed one is unavailable alone, and an update that brings all eleven jobs is accepted', () => {
    const raw = withWorkOrders(rawTechnician());
    (raw.zones.work_orders as { data: unknown }).data = 7;
    const s = new ZoneStore();
    s.initialize(validated(raw).zones);
    expect(s.get('work_orders').condition).toBe('unavailable');
    expect(s.get('alerts').condition).toBe('rendered');
    expect(validateZoneUpdate('work_orders', workOrdersZone('assigned', true)).ok).toBe(true);
  });
});
