import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssistantSession } from './assistantSession';
import { DEFAULT_RUNTIME_CONFIG } from '@/contracts';
import { FakeSocket } from '@/tests/shellFixtures';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';

// BRD 1.2 5.10 (AssistantPanel), BRD 1.0 OQ9 (bidirectional, proactive), SDD 7.10 (the session lives in the runtime).

const turn = (id: string, extra: Record<string, unknown> = {}) => ({ type: 'message', turn: { id, role: 'assistant', text: `Message ${id}`, ...extra } });

function setup() {
  const sockets: FakeSocket[] = [];
  const session = new AssistantSession(() => {
    const s = new FakeSocket();
    sockets.push(s);
    return s;
  }, { ...DEFAULT_RUNTIME_CONFIG.bus, heartbeatMs: 3_600_000 }, () => 0.5);
  session.start();
  return { session, sockets, socket: () => sockets[sockets.length - 1] };
}

beforeEach(() => {
  vi.useFakeTimers();
  clearTelemetryBuffer();
});
afterEach(() => vi.useRealTimers());

describe('AssistantSession: receiving', () => {
  it('starts connecting and becomes connected, and holds a render-only cache of turns', () => {
    const t = setup();
    expect(t.session.getSnapshot()).toMatchObject({ status: 'connecting', turns: [], unread: 0 });
    t.socket().open();
    expect(t.session.getSnapshot().status).toBe('connected');
    t.socket().emit(turn('1'));
    expect(t.session.getSnapshot().turns.map((x) => x.id)).toEqual(['1']);
  });

  it('counts a PROACTIVE message that arrives while the panel is closed as unread', () => {
    const t = setup();
    t.socket().open();
    t.socket().emit(turn('1', { proactive: true }));
    t.socket().emit(turn('2', { proactive: true }));
    expect(t.session.getSnapshot().unread).toBe(2);
  });

  it('does not count a proactive message as unread when the panel is open, and opening clears the count', () => {
    const t = setup();
    t.socket().open();
    t.socket().emit(turn('1', { proactive: true }));
    t.session.setOpen(true);
    expect(t.session.getSnapshot().unread).toBe(0);
    t.socket().emit(turn('2', { proactive: true }));
    expect(t.session.getSnapshot().unread).toBe(0);
  });

  it('does not count a plain reply as unread', () => {
    const t = setup();
    t.socket().open();
    t.socket().emit(turn('1'));
    expect(t.session.getSnapshot().unread).toBe(0);
  });

  it('is idempotent: a replayed frame adds nothing', () => {
    const t = setup();
    t.socket().open();
    t.socket().emit(turn('1'));
    t.socket().emit(turn('1'));
    expect(t.session.getSnapshot().turns).toHaveLength(1);
  });

  it.each([['garbage', 'not json {'], ['wrong shape', { type: 'message', turn: { id: '1' } }], ['unknown type', { type: 'mystery' }], ['empty text', turn('1', { text: '' })]])('drops %s without throwing or rendering a guess', (_n, frame) => {
    const t = setup();
    t.socket().open();
    expect(() => t.socket().emit(frame)).not.toThrow();
    expect(t.session.getSnapshot().turns).toEqual([]);
    expect(getBufferedEvents().map((e) => e.event)).toContain('bus.event_invalid');
  });

  it('swallows heartbeats', () => {
    const t = setup();
    t.socket().open();
    t.socket().emit({ type: 'heartbeat' });
    expect(t.session.getSnapshot().turns).toEqual([]);
  });

  it('keeps only the most recent turns', () => {
    const t = setup();
    t.socket().open();
    for (let i = 0; i < 230; i++) t.socket().emit(turn(`m${i}`));
    const turns = t.session.getSnapshot().turns;
    expect(turns).toHaveLength(200);
    expect(turns.at(-1)?.id).toBe('m229');
  });
});

describe('AssistantSession: sending (the worker authors, the runtime sends)', () => {
  it('sends the validated text over the socket and adds the worker turn to the cache', () => {
    const t = setup();
    t.socket().open();
    expect(t.session.submit('  What did Marcus do last time?  ')).toEqual({ ok: true });
    const sent = JSON.parse(t.socket().outbound[0]);
    expect(sent).toMatchObject({ type: 'user_message', text: 'What did Marcus do last time?' });
    expect(t.session.getSnapshot().turns.at(-1)).toMatchObject({ role: 'user', text: 'What did Marcus do last time?' });
  });

  it('refuses, and sends and caches NOTHING, when the connection is not live (no queueing, no pretending)', () => {
    const t = setup();
    expect(t.session.submit('hello')).toEqual({ ok: false, reason: 'disconnected' }); // still connecting
    t.socket().open();
    t.socket().fail();
    expect(t.session.submit('hello')).toEqual({ ok: false, reason: 'disconnected' }); // reconnecting
    expect(t.socket().outbound).toEqual([]);
    expect(t.session.getSnapshot().turns).toEqual([]);
  });

  it.each([[''], ['   '], ['x'.repeat(2001)]])('rejects an invalid message (%#) before anything leaves the browser', (text) => {
    const t = setup();
    t.socket().open();
    expect(t.session.submit(text)).toEqual({ ok: false, reason: 'invalid' });
    expect(t.socket().outbound).toEqual([]);
  });
});

describe('AssistantSession: connection', () => {
  it('reconnects by itself after a drop and reports each state', () => {
    const t = setup();
    t.socket().open();
    t.socket().fail();
    expect(t.session.getSnapshot().status).toBe('reconnecting');
    vi.advanceTimersByTime(1100);
    expect(t.sockets).toHaveLength(2);
    t.socket().open();
    expect(t.session.getSnapshot().status).toBe('connected');
  });

  it('escalates to failed, and a manual retry can recover', () => {
    const t = setup();
    t.socket().open();
    t.socket().fail();
    for (const wait of [1100, 2100, 4100]) {
      vi.advanceTimersByTime(wait);
      t.socket().fail();
    }
    expect(t.session.getSnapshot().status).toBe('failed');
    t.session.retry();
    t.socket().open();
    expect(t.session.getSnapshot().status).toBe('connected');
  });

  it('drops the cached turns on dispose: nothing from the session survives it', () => {
    const t = setup();
    t.socket().open();
    t.socket().emit(turn('1'));
    t.session.dispose();
    expect(t.socket().closed).toBe(true);
    expect(t.session.getSnapshot().turns).toEqual([]);
  });
});
