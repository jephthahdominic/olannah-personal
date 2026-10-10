import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BusConnection, type BusOptions, type BusState, type EventSourceLike } from './busConnection';

// Bus acceptance scenarios (SDD 12.4, 17.3 "Connectivity"): disconnect, automatic reconnect, backoff, silence
// detection, escalation after 3 attempts or 30 seconds, manual retry, resume.

class FakeSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string; lastEventId?: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  send(data: string, lastEventId?: string) {
    this.onmessage?.({ data, lastEventId });
  }
  fail() {
    this.onerror?.();
  }
}

const OPTS: BusOptions = { heartbeatMs: 10_000, backoffMs: [1000, 2000, 4000, 8000], maxBackoffMs: 30_000, failAfterAttempts: 3, failAfterMs: 30_000, random: () => 0.5 };

function setup(opts: Partial<BusOptions> = {}) {
  const sources: FakeSource[] = [];
  const lastIds: (string | null)[] = [];
  const states: BusState[] = [];
  const events: string[] = [];
  const conn = new BusConnection(
    (lastEventId) => {
      lastIds.push(lastEventId);
      const s = new FakeSource();
      sources.push(s);
      return s;
    },
    { ...OPTS, ...opts },
    { onEvent: (d) => events.push(d), onState: (s) => states.push(s) },
  );
  conn.start();
  return { conn, sources, lastIds, states, events, latest: () => sources[sources.length - 1] };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BusConnection: connecting and receiving', () => {
  it('starts connecting, becomes connected on open, and delivers events', () => {
    const t = setup();
    expect(t.conn.state).toBe('connecting');
    t.latest().open();
    expect(t.conn.state).toBe('connected');
    t.latest().send('{"type":"zone.update"}');
    expect(t.events).toEqual(['{"type":"zone.update"}']);
  });

  it('swallows heartbeats instead of delivering them as events', () => {
    const t = setup();
    t.latest().open();
    t.latest().send('{"type":"heartbeat"}');
    expect(t.events).toEqual([]);
  });

  it('delivers malformed data as-is for the pipeline to reject (it never throws)', () => {
    const t = setup();
    t.latest().open();
    expect(() => t.latest().send('not json {')).not.toThrow();
    expect(t.events).toEqual(['not json {']);
  });
});

describe('BusConnection: disconnect and automatic reconnection', () => {
  it('reconnects automatically after the first backoff with jitter, and returns to connected', () => {
    const t = setup();
    t.latest().open();
    t.latest().fail();
    expect(t.conn.state).toBe('reconnecting');
    expect(t.sources).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(t.sources).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(t.sources).toHaveLength(2);
    t.latest().open();
    expect(t.conn.state).toBe('connected');
    expect(t.states).toEqual(['connected', 'reconnecting', 'connected']);
  });

  it('closes the dead source when it drops', () => {
    const t = setup();
    t.latest().open();
    const first = t.latest();
    first.fail();
    expect(first.closed).toBe(true);
  });

  it('backs off 1s, 2s then escalates after three failed attempts to the failed state', () => {
    const t = setup();
    t.latest().open();
    t.latest().fail(); // the drop
    vi.advanceTimersByTime(1001); // retry 1
    expect(t.sources).toHaveLength(2);
    t.latest().fail(); // attempt 1 fails
    vi.advanceTimersByTime(2001); // retry 2 after 2s
    expect(t.sources).toHaveLength(3);
    t.latest().fail(); // attempt 2 fails
    vi.advanceTimersByTime(4001); // retry 3 after 4s
    expect(t.sources).toHaveLength(4);
    expect(t.conn.state).toBe('reconnecting');
    t.latest().fail(); // attempt 3 fails
    expect(t.conn.state).toBe('failed');
    vi.advanceTimersByTime(120_000);
    expect(t.sources).toHaveLength(4); // no more automatic attempts
  });

  it('escalates after 30 seconds without a connection even if fewer than three attempts have failed', () => {
    const t = setup({ failAfterAttempts: 10, backoffMs: [20_000] });
    t.latest().open();
    t.latest().fail();
    vi.advanceTimersByTime(29_000);
    expect(t.conn.state).toBe('reconnecting');
    vi.advanceTimersByTime(1_500);
    expect(t.conn.state).toBe('failed');
  });

  it('caps the backoff at the maximum', () => {
    const t = setup({ backoffMs: [100_000], failAfterAttempts: 5, failAfterMs: 600_000 });
    t.latest().open();
    t.latest().fail();
    vi.advanceTimersByTime(30_000 * 1.2 + 1);
    expect(t.sources).toHaveLength(2);
  });

  it('applies jitter within plus or minus 20 percent', () => {
    const early = setup({ random: () => 0 });
    early.latest().open();
    early.latest().fail();
    vi.advanceTimersByTime(799);
    expect(early.sources).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(early.sources).toHaveLength(2);
  });
});

describe('BusConnection: silence detection', () => {
  it('treats silence for twice the heartbeat interval as a disconnect, even if the stream never errors', () => {
    const t = setup();
    t.latest().open();
    vi.advanceTimersByTime(19_999);
    expect(t.conn.state).toBe('connected');
    vi.advanceTimersByTime(2);
    expect(t.conn.state).toBe('reconnecting');
  });

  it('a heartbeat resets the silence clock', () => {
    const t = setup();
    t.latest().open();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(15_000);
      t.latest().send('{"type":"heartbeat"}');
    }
    expect(t.conn.state).toBe('connected');
  });

  it('a real event also resets the silence clock', () => {
    const t = setup();
    t.latest().open();
    vi.advanceTimersByTime(15_000);
    t.latest().send('{"type":"zone.update"}');
    vi.advanceTimersByTime(15_000);
    expect(t.conn.state).toBe('connected');
  });
});

describe('BusConnection: manual retry and shutdown', () => {
  function failedConnection() {
    const t = setup();
    t.latest().open();
    t.latest().fail();
    for (const wait of [1001, 2001, 4001]) {
      vi.advanceTimersByTime(wait);
      t.latest().fail();
    }
    expect(t.conn.state).toBe('failed');
    return t;
  }

  it('retry from failed reconnects immediately and can succeed', () => {
    const t = failedConnection();
    const before = t.sources.length;
    t.conn.retry();
    expect(t.conn.state).toBe('reconnecting');
    expect(t.sources).toHaveLength(before + 1);
    t.latest().open();
    expect(t.conn.state).toBe('connected');
  });

  it('retry gives a fresh set of attempts', () => {
    const t = failedConnection();
    t.conn.retry();
    t.latest().fail();
    vi.advanceTimersByTime(2001);
    expect(t.conn.state).toBe('reconnecting');
  });

  it('retry does nothing unless the connection has failed', () => {
    const t = setup();
    t.latest().open();
    t.conn.retry();
    expect(t.sources).toHaveLength(1);
  });

  it('close stops everything and ignores late callbacks', () => {
    const t = setup();
    const source = t.latest();
    source.open();
    t.conn.close();
    expect(source.closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(t.sources).toHaveLength(1);
    expect(t.conn.state).toBe('connected');
  });

  it('ignores events from a source that has been replaced', () => {
    const t = setup();
    const old = t.latest();
    old.open();
    old.fail();
    vi.advanceTimersByTime(1001);
    old.send('{"type":"stale"}');
    expect(t.events).toEqual([]);
  });
});

describe('BusConnection: resume', () => {
  it('offers the last event id to the next connection', () => {
    const t = setup();
    t.latest().open();
    t.latest().send('{"type":"zone.update"}', 'evt-42');
    t.latest().fail();
    vi.advanceTimersByTime(1001);
    expect(t.lastIds).toEqual([null, 'evt-42']);
    expect(t.conn.lastEventId).toBe('evt-42');
  });

  it('reports whether it has ever connected, so the first failure is not mistaken for a lost connection', () => {
    const t = setup();
    expect(t.conn.everConnected).toBe(false);
    t.latest().open();
    expect(t.conn.everConnected).toBe(true);
  });
});
