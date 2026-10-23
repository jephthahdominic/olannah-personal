import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoneStore } from './zoneStore';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';

beforeEach(() => clearTelemetryBuffer());

describe('ZoneStore ingestion (BRD 1.0 SR21A: a bad zone payload degrades that zone only)', () => {
  it('leaves a zone with no payload scaffolded (waiting for data, not an error)', () => {
    const s = new ZoneStore();
    s.initialize(['primary', 'context'], {});
    expect(s.get('primary').condition).toBe('scaffolded');
  });

  it('maps ready, empty, degraded and unavailable payloads to their conditions', () => {
    const s = new ZoneStore();
    s.initialize(['a', 'b', 'c', 'd'], {
      a: { status: 'ready' },
      b: { status: 'empty' },
      c: { status: 'degraded', message: 'Some of this section is limited.' },
      d: { status: 'unavailable', message: 'Service history is temporarily unavailable.' },
    });
    expect(s.get('a')).toMatchObject({ condition: 'rendered', degraded: false });
    expect(s.get('b').condition).toBe('empty');
    expect(s.get('c')).toMatchObject({ condition: 'rendered', degraded: true, message: 'Some of this section is limited.' });
    expect(s.get('d')).toMatchObject({ condition: 'unavailable', message: 'Service history is temporarily unavailable.' });
  });

  it('degrades only the malformed zone, logs a structured event, and leaves the others alone', () => {
    const s = new ZoneStore();
    s.initialize(['good', 'bad'], { good: { status: 'ready' }, bad: { status: 'nonsense' } });
    expect(s.get('good').condition).toBe('rendered');
    expect(s.get('bad').condition).toBe('unavailable');
    expect(getBufferedEvents().map((e) => e.event)).toEqual(['zone.payload_malformed']);
  });

  it('never infers degradation: a degraded zone that supplies no message is treated as malformed', () => {
    const s = new ZoneStore();
    s.initialize(['z'], { z: { status: 'degraded' } });
    expect(s.get('z').condition).toBe('unavailable');
  });

  it('does not throw on arbitrary junk', () => {
    const s = new ZoneStore();
    expect(() => s.initialize(['z'], { z: 42 })).not.toThrow();
    expect(() => s.initialize(['z'], { z: null })).not.toThrow();
  });
});

describe('ZoneStore subscriptions are per zone', () => {
  it('notifies only the subscribers of the zone that changed', () => {
    const s = new ZoneStore();
    s.initialize(['a', 'b'], { a: { status: 'ready' }, b: { status: 'ready' } });
    const a = vi.fn();
    const b = vi.fn();
    s.subscribe('a')(a);
    s.subscribe('b')(b);
    s.markUnavailable('a');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('does not notify when nothing actually changed', () => {
    const s = new ZoneStore();
    s.initialize(['a'], { a: { status: 'empty' } });
    const l = vi.fn();
    s.subscribe('a')(l);
    s.set('a', s.get('a'));
    expect(l).not.toHaveBeenCalled();
  });

  it('keeps refresh and condition as separate dimensions (a stale zone can also be refreshing)', () => {
    const s = new ZoneStore();
    s.initialize(['a'], { a: { status: 'ready' } });
    s.set('a', { ...s.get('a'), condition: 'stale', refreshing: true });
    expect(s.get('a')).toMatchObject({ condition: 'stale', refreshing: true });
  });
});
