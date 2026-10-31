import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UpdatePipeline } from './updatePipeline';
import { ZoneStore } from '../zones/zoneStore';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';
import { rawTechnician, validated } from '@/tests/wireFixtures';

// BRD 1.0 UR6 to UR8 and SR20/21, SDD 7.5 and 17.3 "Zones".

// An alerts zone as it arrives on the bus. `message` is the one thing the tests vary, so they can tell which update is on screen.
const ready = (message = 'Northgate') => ({ state: 'rendered', as_of: '2026-10-23T08:00:03-05:00', data: [{ id: 'a1', severity: 'warning', message, suggestion: null, evidence: [] }] });
const shown = (t: { store: ZoneStore }) => (t.store.get('alerts').data as { message: string }[])[0].message;
const event = (zoneId: string, payload: unknown, seq?: number) => JSON.stringify({ type: 'zone.update', zoneId, ...(seq !== undefined ? { seq } : {}), payload });

function setup(overrides: Partial<ConstructorParameters<typeof UpdatePipeline>[0]> = {}) {
  const store = new ZoneStore();
  store.initialize(validated(rawTechnician()).zones);
  // Start from known data in the alerts zone, so a test can tell "not applied yet" from "applied".
  store.apply('alerts', ready() as never);
  // A manual coalescing window, so each test controls exactly when the frame "arrives".
  let frame: (() => void) | null = null;
  const metrics: { zoneKey: string; receivedToRenderedMs: number }[] = [];
  let clock = 1_000_000;
  const pipeline = new UpdatePipeline({
    store,
    stalenessWarnMs: 30_000,
    schedule: (f) => (frame = f),
    now: () => clock,
    onMetric: (m) => metrics.push(m),
    ...overrides,
  });
  return {
    store,
    pipeline,
    metrics,
    flush: () => {
      const f = frame;
      frame = null;
      f?.();
    },
    advanceClock: (ms: number) => void (clock += ms),
    /** What a zone does after React commits the new data. */
    render: (key: string) => store.markRendered(key, store.get(key).version),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  clearTelemetryBuffer();
});
afterEach(() => vi.useRealTimers());

describe('update pipeline: refreshing indicator (BRD 1.0 UR7)', () => {
  it('shows the indicator immediately on receipt, before anything is applied', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready('Updated')));
    expect(t.store.get('alerts').refreshing).toBe(true);
    expect(shown(t)).toBe('Northgate'); // not applied yet
  });

  it('keeps the indicator after the data is applied, and clears it ONLY once the zone confirms it rendered', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready('Updated')));
    t.flush();
    expect(shown(t)).toBe('Updated');
    expect(t.store.get('alerts').refreshing).toBe(true); // a premature clear here is a test failure
    t.render('alerts');
    expect(t.store.get('alerts').refreshing).toBe(false);
  });

  it('does not clear the indicator for a render confirmation of an older version', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready('A')));
    t.flush();
    const oldVersion = t.store.get('alerts').version;
    t.pipeline.receive(event('alerts', ready('B')));
    t.flush();
    t.store.markRendered('alerts', oldVersion);
    expect(t.store.get('alerts').refreshing).toBe(true);
    t.render('alerts');
    expect(t.store.get('alerts').refreshing).toBe(false);
  });

  it('changes the indicator to a warning after 30 seconds, keeps the data, and does not block the worker', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready('Slow')));
    vi.advanceTimersByTime(29_999);
    expect(t.store.get('alerts').refreshDelayed).toBe(false);
    vi.advanceTimersByTime(2);
    const s = t.store.get('alerts');
    expect(s.refreshing).toBe(true);
    expect(s.refreshDelayed).toBe(true);
    expect(s.condition).toBe('rendered'); // last known data stays; the zone is not marked failed
    expect(getBufferedEvents().map((e) => e.event)).toContain('zone.refresh_delayed');
  });

  it('clears the warning too when the refresh finally renders', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready()));
    vi.advanceTimersByTime(31_000);
    t.flush();
    t.render('alerts');
    expect(t.store.get('alerts')).toMatchObject({ refreshing: false, refreshDelayed: false });
  });

  it('does not warn once the refresh has rendered in time', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready()));
    t.flush();
    t.render('alerts');
    vi.advanceTimersByTime(60_000);
    expect(getBufferedEvents().map((e) => e.event)).not.toContain('zone.refresh_delayed');
  });
});

describe('update pipeline: only the affected zone changes (BRD 1.0 UR6B)', () => {
  it('leaves other zones untouched and notifies only the affected zone', () => {
    const t = setup();
    const other = vi.fn();
    const target = vi.fn();
    t.store.subscribe('steps')(other);
    t.store.subscribe('alerts')(target);
    t.pipeline.receive(event('alerts', ready('Only me')));
    t.flush();
    expect(target).toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
    expect(t.store.get('steps').refreshing).toBe(false);
  });
});

describe('update pipeline: coalescing', () => {
  it('collapses several events for the same zone inside one frame to the latest, applied once', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready('First')));
    t.pipeline.receive(event('alerts', ready('Second')));
    t.pipeline.receive(event('alerts', ready('Third')));
    const before = t.store.get('alerts').version;
    t.flush();
    expect(t.store.get('alerts').version).toBe(before + 1);
    expect(shown(t)).toBe('Third');
  });

  it('applies updates for several zones as one batch', () => {
    const applyBatch = vi.fn((f: () => void) => f());
    const t = setup({ applyBatch });
    t.pipeline.receive(event('alerts', ready()));
    t.pipeline.receive(event('steps', { state: 'rendered', as_of: null, data: [] }));
    t.flush();
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('applies inside the supplied batch wrapper (a low-priority transition in the app)', () => {
    const order: string[] = [];
    const t = setup({
      applyBatch: (f) => {
        order.push('batch-start');
        f();
        order.push('batch-end');
      },
    });
    t.store.subscribe('alerts')(() => order.push('zone-updated'));
    t.pipeline.receive(event('alerts', ready()));
    order.length = 0;
    t.flush();
    expect(order).toEqual(['batch-start', 'zone-updated', 'batch-end']);
  });
});

describe('update pipeline: bad input never crashes (BRD 1.0 SR21)', () => {
  it('a malformed zone payload makes that zone unavailable and logs, leaving every other zone alone', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', { state: 'stale', as_of: null, data: [] }));
    expect(t.store.get('alerts').condition).toBe('unavailable');
    expect(t.store.get('steps').condition).toBe('rendered');
    expect(getBufferedEvents().map((e) => e.event)).toContain('zone.payload_malformed');
  });

  it('a payload whose DATA shape is unknown is treated as malformed for that zone', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', { state: 'rendered', as_of: null, data: 'something-new' }));
    expect(t.store.get('alerts').condition).toBe('unavailable');
  });

  it.each([
    ['not json', 'not json {'],
    ['not an object', '"hello"'],
    ['missing zone id', JSON.stringify({ type: 'zone.update', payload: {} })],
    ['unknown zone key', JSON.stringify({ type: 'zone.update', zoneId: '../../etc', payload: {} })],
    ['null', 'null'],
  ])('drops a message with %s as a global envelope failure, without throwing or touching any zone', (_name, raw) => {
    const t = setup();
    const before = JSON.stringify([t.store.get('alerts'), t.store.get('steps')]);
    expect(() => t.pipeline.receive(raw)).not.toThrow();
    expect(JSON.stringify([t.store.get('alerts'), t.store.get('steps')])).toBe(before);
    expect(getBufferedEvents().map((e) => e.event)).toContain('bus.event_invalid');
  });

  it('ignores an event type it does not render', () => {
    const t = setup();
    t.pipeline.receive(JSON.stringify({ type: 'something.else', zoneId: 'alerts', payload: {} }));
    expect(t.store.get('alerts').refreshing).toBe(false);
  });
});

describe('update pipeline: idempotent updates', () => {
  it('drops a replayed or out-of-order event when the bus supplies a sequence number', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready('Seq 5'), 5));
    t.flush();
    t.render('alerts');
    const v = t.store.get('alerts').version;
    t.pipeline.receive(event('alerts', ready('Seq 4 (late)'), 4));
    t.pipeline.receive(event('alerts', ready('Seq 5 (replay)'), 5));
    t.flush();
    expect(t.store.get('alerts').version).toBe(v);
    expect(shown(t)).toBe('Seq 5');
    expect(getBufferedEvents().filter((e) => e.event === 'bus.event_dropped')).toHaveLength(2);
  });

  it('sequence numbers are tracked per zone', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready(), 9));
    t.pipeline.receive(event('steps', { status: 'ready' }, 1));
    t.flush();
    expect(getBufferedEvents().map((e) => e.event)).not.toContain('bus.event_dropped');
  });
});

describe('update pipeline: checkpoint gate (BRD 1.0 UR12)', () => {
  it('queues updates while blocked, changes nothing, and applies them in order when released', () => {
    let blocked = true;
    const t = setup({ isBlocked: () => blocked });
    const snapshot = JSON.stringify(t.store.get('alerts'));
    t.pipeline.receive(event('alerts', ready('Held')));
    t.flush();
    expect(JSON.stringify(t.store.get('alerts'))).toBe(snapshot);
    expect(t.pipeline.queuedCount).toBe(1);

    blocked = false;
    t.pipeline.drainQueue();
    t.flush();
    expect(shown(t)).toBe('Held');
    expect(t.pipeline.queuedCount).toBe(0);
  });
});

describe('update pipeline: performance measurement', () => {
  it('reports the time from receipt to confirmed render, to be asserted against the 400ms P95 target', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready()));
    t.advanceClock(120);
    t.flush();
    t.advanceClock(80);
    t.render('alerts');
    expect(t.metrics).toEqual([{ zoneKey: 'alerts', receivedToRenderedMs: 200 }]);
  });
});

describe('update pipeline: lifecycle', () => {
  it('ignores everything after dispose and cancels its timers', () => {
    const t = setup();
    t.pipeline.receive(event('alerts', ready()));
    t.pipeline.dispose();
    vi.advanceTimersByTime(60_000);
    t.flush();
    expect(t.store.get('alerts').refreshDelayed).toBe(false);
    t.pipeline.receive(event('alerts', ready('After')));
    t.flush();
    expect(shown(t)).toBe('Northgate');
  });
});
