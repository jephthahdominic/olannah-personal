import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UpdatePipeline } from './updatePipeline';
import { ZoneStore } from '../zones/zoneStore';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';

// BRD 1.0 UR6 to UR8 and SR20/21, SDD 7.5 and 17.3 "Zones".

const ready = (extra: Record<string, unknown> = {}) => ({ status: 'ready', data: { kind: 'context', title: 'Northgate', lines: [], historyTitle: 'History', ...extra } });
const event = (zoneId: string, payload: unknown, seq?: number) => JSON.stringify({ type: 'zone.update', zoneId, ...(seq !== undefined ? { seq } : {}), payload });

function setup(overrides: Partial<ConstructorParameters<typeof UpdatePipeline>[0]> = {}) {
  const store = new ZoneStore();
  store.initialize(['primary:dashboard', 'context'], { 'primary:dashboard': { status: 'ready' }, context: ready() });
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
    t.pipeline.receive(event('context', ready({ title: 'Updated' })));
    expect(t.store.get('context').refreshing).toBe(true);
    expect((t.store.get('context').data as { title: string }).title).toBe('Northgate'); // not applied yet
  });

  it('keeps the indicator after the data is applied, and clears it ONLY once the zone confirms it rendered', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready({ title: 'Updated' })));
    t.flush();
    expect((t.store.get('context').data as { title: string }).title).toBe('Updated');
    expect(t.store.get('context').refreshing).toBe(true); // a premature clear here is a test failure
    t.render('context');
    expect(t.store.get('context').refreshing).toBe(false);
  });

  it('does not clear the indicator for a render confirmation of an older version', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready({ title: 'A' })));
    t.flush();
    const oldVersion = t.store.get('context').version;
    t.pipeline.receive(event('context', ready({ title: 'B' })));
    t.flush();
    t.store.markRendered('context', oldVersion);
    expect(t.store.get('context').refreshing).toBe(true);
    t.render('context');
    expect(t.store.get('context').refreshing).toBe(false);
  });

  it('changes the indicator to a warning after 30 seconds, keeps the data, and does not block the worker', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready({ title: 'Slow' })));
    vi.advanceTimersByTime(29_999);
    expect(t.store.get('context').refreshDelayed).toBe(false);
    vi.advanceTimersByTime(2);
    const s = t.store.get('context');
    expect(s.refreshing).toBe(true);
    expect(s.refreshDelayed).toBe(true);
    expect(s.condition).toBe('rendered'); // last known data stays; the zone is not marked failed
    expect(getBufferedEvents().map((e) => e.event)).toContain('zone.refresh_delayed');
  });

  it('clears the warning too when the refresh finally renders', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready()));
    vi.advanceTimersByTime(31_000);
    t.flush();
    t.render('context');
    expect(t.store.get('context')).toMatchObject({ refreshing: false, refreshDelayed: false });
  });

  it('does not warn once the refresh has rendered in time', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready()));
    t.flush();
    t.render('context');
    vi.advanceTimersByTime(60_000);
    expect(getBufferedEvents().map((e) => e.event)).not.toContain('zone.refresh_delayed');
  });
});

describe('update pipeline: only the affected zone changes (BRD 1.0 UR6B)', () => {
  it('leaves other zones untouched and notifies only the affected zone', () => {
    const t = setup();
    const other = vi.fn();
    const target = vi.fn();
    t.store.subscribe('primary:dashboard')(other);
    t.store.subscribe('context')(target);
    t.pipeline.receive(event('context', ready({ title: 'Only me' })));
    t.flush();
    expect(target).toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
    expect(t.store.get('primary:dashboard').refreshing).toBe(false);
  });
});

describe('update pipeline: coalescing', () => {
  it('collapses several events for the same zone inside one frame to the latest, applied once', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready({ title: 'First' })));
    t.pipeline.receive(event('context', ready({ title: 'Second' })));
    t.pipeline.receive(event('context', ready({ title: 'Third' })));
    const before = t.store.get('context').version;
    t.flush();
    expect(t.store.get('context').version).toBe(before + 1);
    expect((t.store.get('context').data as { title: string }).title).toBe('Third');
  });

  it('applies updates for several zones as one batch', () => {
    const applyBatch = vi.fn((f: () => void) => f());
    const t = setup({ applyBatch });
    t.pipeline.receive(event('context', ready()));
    t.pipeline.receive(event('primary:dashboard', { status: 'ready' }));
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
    t.store.subscribe('context')(() => order.push('zone-updated'));
    t.pipeline.receive(event('context', ready()));
    order.length = 0;
    t.flush();
    expect(order).toEqual(['batch-start', 'zone-updated', 'batch-end']);
  });
});

describe('update pipeline: bad input never crashes (BRD 1.0 SR21)', () => {
  it('a malformed zone payload makes that zone unavailable and logs, leaving every other zone alone', () => {
    const t = setup();
    t.pipeline.receive(event('context', { status: 'nonsense' }));
    expect(t.store.get('context').condition).toBe('unavailable');
    expect(t.store.get('primary:dashboard').condition).toBe('rendered');
    expect(getBufferedEvents().map((e) => e.event)).toContain('zone.payload_malformed');
  });

  it('a payload whose DATA shape is unknown is treated as malformed for that zone', () => {
    const t = setup();
    t.pipeline.receive(event('context', { status: 'ready', data: { kind: 'something-new', x: 1 } }));
    expect(t.store.get('context').condition).toBe('unavailable');
  });

  it.each([
    ['not json', 'not json {'],
    ['not an object', '"hello"'],
    ['missing zone id', JSON.stringify({ type: 'zone.update', payload: {} })],
    ['unknown zone key', JSON.stringify({ type: 'zone.update', zoneId: '../../etc', payload: {} })],
    ['null', 'null'],
  ])('drops a message with %s as a global envelope failure, without throwing or touching any zone', (_name, raw) => {
    const t = setup();
    const before = JSON.stringify([t.store.get('context'), t.store.get('primary:dashboard')]);
    expect(() => t.pipeline.receive(raw)).not.toThrow();
    expect(JSON.stringify([t.store.get('context'), t.store.get('primary:dashboard')])).toBe(before);
    expect(getBufferedEvents().map((e) => e.event)).toContain('bus.event_invalid');
  });

  it('ignores an event type it does not render', () => {
    const t = setup();
    t.pipeline.receive(JSON.stringify({ type: 'something.else', zoneId: 'context', payload: {} }));
    expect(t.store.get('context').refreshing).toBe(false);
  });
});

describe('update pipeline: idempotent updates', () => {
  it('drops a replayed or out-of-order event when the bus supplies a sequence number', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready({ title: 'Seq 5' }), 5));
    t.flush();
    t.render('context');
    const v = t.store.get('context').version;
    t.pipeline.receive(event('context', ready({ title: 'Seq 4 (late)' }), 4));
    t.pipeline.receive(event('context', ready({ title: 'Seq 5 (replay)' }), 5));
    t.flush();
    expect(t.store.get('context').version).toBe(v);
    expect((t.store.get('context').data as { title: string }).title).toBe('Seq 5');
    expect(getBufferedEvents().filter((e) => e.event === 'bus.event_dropped')).toHaveLength(2);
  });

  it('sequence numbers are tracked per zone', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready(), 9));
    t.pipeline.receive(event('primary:dashboard', { status: 'ready' }, 1));
    t.flush();
    expect(getBufferedEvents().map((e) => e.event)).not.toContain('bus.event_dropped');
  });
});

describe('update pipeline: checkpoint gate (BRD 1.0 UR12)', () => {
  it('queues updates while blocked, changes nothing, and applies them in order when released', () => {
    let blocked = true;
    const t = setup({ isBlocked: () => blocked });
    const snapshot = JSON.stringify(t.store.get('context'));
    t.pipeline.receive(event('context', ready({ title: 'Held' })));
    t.flush();
    expect(JSON.stringify(t.store.get('context'))).toBe(snapshot);
    expect(t.pipeline.queuedCount).toBe(1);

    blocked = false;
    t.pipeline.drainQueue();
    t.flush();
    expect((t.store.get('context').data as { title: string }).title).toBe('Held');
    expect(t.pipeline.queuedCount).toBe(0);
  });
});

describe('update pipeline: performance measurement', () => {
  it('reports the time from receipt to confirmed render, to be asserted against the 400ms P95 target', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready()));
    t.advanceClock(120);
    t.flush();
    t.advanceClock(80);
    t.render('context');
    expect(t.metrics).toEqual([{ zoneKey: 'context', receivedToRenderedMs: 200 }]);
  });
});

describe('update pipeline: lifecycle', () => {
  it('ignores everything after dispose and cancels its timers', () => {
    const t = setup();
    t.pipeline.receive(event('context', ready()));
    t.pipeline.dispose();
    vi.advanceTimersByTime(60_000);
    t.flush();
    expect(t.store.get('context').refreshDelayed).toBe(false);
    t.pipeline.receive(event('context', ready({ title: 'After' })));
    t.flush();
    expect((t.store.get('context').data as { title: string }).title).toBe('Northgate');
  });
});
