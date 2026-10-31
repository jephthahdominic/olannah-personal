import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CanvasRuntime } from './canvasRuntime';
import { DEFAULT_RUNTIME_CONFIG } from '@/contracts';
import { rawFixture, rawTechnician, validated } from '@/tests/wireFixtures';
import { withWorkOrders, workOrdersZone } from '@/contracts/fixtures/workOrders';
import type { EventSourceLike } from '@/clients/bus/busConnection';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';
import { purgeSession } from '../purgeSession';

// Connectivity acceptance scenarios (SDD 17.3): bus loss preserves state and shows staleness, writes disabled,
// reconnect restores and refreshes, reconnect failure escalates; plus the live update path and history second pass.

class FakeSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string; lastEventId?: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  close() {
    this.closed = true;
  }
}

function setup(over: { refresh?: () => Promise<unknown>; history?: () => Promise<unknown> } = {}) {
  const sources: FakeSource[] = [];
  const contextRequest = vi.fn(over.refresh ?? (async () => rawTechnician()));
  const historyRequest = vi.fn(over.history ?? (async () => rawFixture('history.happy')));
  const runtime = new CanvasRuntime({
    context: validated(rawTechnician()),
    session: { userId: 'u', tenantId: 't', resolvedRole: 'technician' },
    config: { ...DEFAULT_RUNTIME_CONFIG, bus: { ...DEFAULT_RUNTIME_CONFIG.bus, backoffMs: [1000, 2000, 4000], heartbeatMs: 3_600_000 } },
    upstream: {
      context: { request: contextRequest },
      history: { request: historyRequest },
      createBusSource: () => {
        const s = new FakeSource();
        sources.push(s);
        return s;
      },
      createAssistantSource: () => new FakeSource(),
      feedback: { submit: async () => true },
    },
    schedule: (f) => f(),
    random: () => 0.5,
  });
  const latest = () => sources[sources.length - 1];
  const render = () => runtime.zones.keys().forEach((k) => runtime.zones.markRendered(k, runtime.zones.get(k).version));
  return { runtime, sources, latest, contextRequest, historyRequest, render };
}
const flushPromises = () => vi.advanceTimersByTimeAsync(0);
// A zone update as the bus delivers it: an alerts zone in the DELIVERED shape.
const NEW_ALERTS = { state: 'rendered', as_of: '2026-10-23T09:00:00-05:00', data: [{ id: 'a9', severity: 'critical', message: 'Store manager update received', suggestion: null, evidence: [] }] };

beforeEach(() => {
  vi.useFakeTimers();
  clearTelemetryBuffer();
});
afterEach(async () => {
  await purgeSession();
  vi.useRealTimers();
});

describe('CanvasRuntime: initial state', () => {
  it('has zone data from the context object before it starts, so the first render is never empty', () => {
    const { runtime } = setup();
    for (const key of ['alerts', 'work_order', 'steps', 'actions', 'history']) expect(runtime.zones.get(key).condition, key).toBe('rendered');
    expect(runtime.getConnection()).toBe('connecting');
  });

  it('writes are unavailable until the connection is live', () => {
    const { runtime, latest } = setup();
    runtime.start();
    expect(runtime.canWrite).toBe(false);
    latest().onopen!();
    expect(runtime.getConnection()).toBe('connected');
    expect(runtime.canWrite).toBe(true);
  });
});

describe('CanvasRuntime: live updates', () => {
  it('applies a zone update from the bus, with the refreshing indicator cleared only after render', async () => {
    const { runtime, latest, render } = setup();
    runtime.start();
    latest().onopen!();
    latest().onmessage!({ data: JSON.stringify({ type: 'zone.update', zoneId: 'alerts', payload: NEW_ALERTS }) });
    const s = runtime.zones.get('alerts');
    expect((s.data as { message: string }[])[0].message).toBe('Store manager update received');
    expect(s.asOf).toBe('2026-10-23T09:00:00-05:00');
    expect(s.refreshing).toBe(true);
    render();
    expect(runtime.zones.get('alerts').refreshing).toBe(false);
  });

  it('leaves every other zone alone during an update', () => {
    const { runtime, latest } = setup();
    runtime.start();
    latest().onopen!();
    const other = vi.fn();
    runtime.zones.subscribe('steps')(other);
    latest().onmessage!({ data: JSON.stringify({ type: 'zone.update', zoneId: 'alerts', payload: NEW_ALERTS }) });
    expect(other).not.toHaveBeenCalled();
  });
});

describe('CanvasRuntime: connection loss', () => {
  it('keeps the last data, marks data zones stale, and keeps writes disabled, then reconnects by itself', async () => {
    const { runtime, sources, latest } = setup();
    runtime.start();
    latest().onopen!();
    const before = runtime.zones.get('alerts').data;

    latest().onerror!();
    expect(runtime.getConnection()).toBe('reconnecting');
    expect(runtime.zones.get('alerts')).toMatchObject({ condition: 'stale' });
    expect(runtime.zones.get('alerts').data).toBe(before); // last known data preserved
    expect(runtime.canWrite).toBe(false);
    expect(getBufferedEvents().map((e) => e.event)).toContain('bus.disconnected');

    await vi.advanceTimersByTimeAsync(1100);
    expect(sources).toHaveLength(2); // automatic reconnection
  });

  it('on reconnect refreshes every zone (events may have been missed) and clears staleness once rendered', async () => {
    const { runtime, latest, contextRequest, render } = setup();
    runtime.start();
    latest().onopen!();
    latest().onerror!();
    await vi.advanceTimersByTimeAsync(1100);
    latest().onopen!();
    expect(getBufferedEvents().map((e) => e.event)).toContain('bus.reconnected');
    await flushPromises();
    expect(contextRequest).toHaveBeenCalledTimes(1);
    render();
    expect(runtime.zones.get('alerts').condition).toBe('rendered');
    expect(runtime.zones.get('alerts').refreshing).toBe(false);
    expect(runtime.canWrite).toBe(true);
  });

  it('a first-ever connection does not trigger a refresh (nothing was missed)', async () => {
    const { runtime, latest, contextRequest } = setup();
    runtime.start();
    latest().onopen!();
    await flushPromises();
    expect(contextRequest).not.toHaveBeenCalled();
  });

  it('escalates to failed after three failed attempts, keeps the last data, and a manual retry can recover', async () => {
    const { runtime, sources, latest } = setup();
    runtime.start();
    latest().onopen!();
    latest().onerror!();
    for (const wait of [1100, 2100, 4100]) {
      await vi.advanceTimersByTimeAsync(wait);
      latest().onerror!();
    }
    expect(runtime.getConnection()).toBe('failed');
    expect(runtime.zones.get('alerts').condition).toBe('stale');
    expect(getBufferedEvents().map((e) => e.event)).toContain('bus.reconnect_failed');

    const count = sources.length;
    runtime.retryConnection();
    expect(sources).toHaveLength(count + 1);
    latest().onopen!();
    expect(runtime.getConnection()).toBe('connected');
  });

  it('notifies connection subscribers on each change', () => {
    const { runtime, latest } = setup();
    const l = vi.fn();
    runtime.subscribeConnection(l);
    runtime.start();
    latest().onopen!();
    latest().onerror!();
    expect(l).toHaveBeenCalledTimes(2);
  });
});

describe('CanvasRuntime: refresh', () => {
  it('refreshes automatically every five minutes', async () => {
    const { runtime, latest, contextRequest } = setup();
    runtime.start();
    latest().onopen!();
    await vi.advanceTimersByTimeAsync(300_100);
    expect(contextRequest).toHaveBeenCalledTimes(1);
  });

  it('warns at 30 seconds when a refresh never answers, keeping the data and not blocking the worker', async () => {
    const { runtime, latest } = setup({ refresh: () => new Promise(() => {}) });
    runtime.start();
    latest().onopen!();
    void runtime.refreshAll();
    await vi.advanceTimersByTimeAsync(30_100);
    expect(runtime.zones.get('alerts')).toMatchObject({ condition: 'rendered', refreshing: true, refreshDelayed: true });
  });
});

describe('CanvasRuntime: history second pass', () => {
  it('requests history only when started, after the zones already exist, and never blocks them', async () => {
    const { runtime, historyRequest } = setup();
    expect(historyRequest).not.toHaveBeenCalled();
    expect(runtime.history.getSnapshot().status).toBe('loading');
    runtime.start();
    // The opaque pointer from the context object, handed on untouched.
    expect(historyRequest).toHaveBeenCalledWith('hist_s_8f2_E-2231');
    await flushPromises();
    expect(runtime.history.getSnapshot().status).toBe('ready');
  });

  it('shows history as unavailable on failure while the other zones keep working', async () => {
    const { runtime } = setup({ history: () => Promise.reject(new Error('down')) });
    runtime.start();
    await flushPromises();
    expect(runtime.history.getSnapshot().status).toBe('error');
    expect(runtime.zones.get('alerts').condition).toBe('rendered');
  });
});

describe('CanvasRuntime: lifecycle', () => {
  it('stops everything on dispose: no reconnects, no refreshes, no events', async () => {
    const { runtime, sources, latest, contextRequest } = setup();
    runtime.start();
    latest().onopen!();
    runtime.dispose();
    expect(latest().closed).toBe(true);
    await vi.advanceTimersByTimeAsync(900_000);
    expect(sources).toHaveLength(1);
    expect(contextRequest).not.toHaveBeenCalled();
  });

  it('can be started again after dispose (React StrictMode remounts), and dispose twice is safe', () => {
    const { runtime, sources } = setup();
    runtime.start();
    runtime.dispose();
    runtime.dispose();
    runtime.start();
    expect(sources).toHaveLength(2);
    sources[1].onopen!();
    expect(runtime.getConnection()).toBe('connected');
  });

  it('is torn down by purgeSession, the single exit path', async () => {
    const { runtime, latest } = setup();
    runtime.start();
    const source = latest();
    await purgeSession();
    expect(source.closed).toBe(true);
  });
});

describe('CanvasRuntime: asking for more rows of a zone', () => {
  function withMore(requestMore?: () => Promise<unknown>) {
    const t = setup();
    const raw = withWorkOrders(rawTechnician());
    const runtime = new CanvasRuntime({
      context: validated(raw),
      session: { userId: 'u', tenantId: 't', resolvedRole: 'technician' },
      config: DEFAULT_RUNTIME_CONFIG,
      upstream: {
        context: { request: async () => raw, ...(requestMore ? { requestMore } : {}) },
        history: { request: async () => rawFixture('history.happy') },
        createBusSource: () => ({ onopen: null, onmessage: null, onerror: null, close() {} }),
        createAssistantSource: () => ({ onopen: null, onmessage: null, onerror: null, close() {} }),
        feedback: { submit: async () => true },
      },
      schedule: (f) => f(),
      random: () => 0.5,
    });
    void t;
    return runtime;
  }

  it('applies the zone the channel supplies through the normal pipeline, and is busy only while it waits', async () => {
    let resolve!: (v: unknown) => void;
    const runtime = withMore(() => new Promise((r) => (resolve = r)));
    runtime.start();
    const pending = runtime.requestMore('work_orders', 'tomorrow');
    expect(runtime.moreLoadingKeys()).toBe('work_orders:tomorrow');
    resolve(workOrdersZone('assigned', true));
    expect(await pending).toBe(true);
    expect(runtime.moreLoadingKeys()).toBe('');
    expect((runtime.zones.get('work_orders').data as { groups: { items: unknown[] }[] }).groups[1].items).toHaveLength(11);
    runtime.dispose();
  });

  it('ignores a second request for the same group while one is pending, so the channel is asked once', async () => {
    let calls = 0;
    let resolve!: (v: unknown) => void;
    const runtime = withMore(() => ((calls += 1), new Promise((r) => (resolve = r))));
    runtime.start();
    const first = runtime.requestMore('work_orders', 'tomorrow');
    await runtime.requestMore('work_orders', 'tomorrow');
    expect(calls).toBe(1);
    resolve(workOrdersZone('assigned', true));
    await first;
    runtime.dispose();
  });

  it('reports failure (false) when the channel rejects or cannot, and keeps the rows it has', async () => {
    const rejecting = withMore(() => Promise.reject(new Error('down')));
    rejecting.start();
    expect(await rejecting.requestMore('work_orders', 'tomorrow')).toBe(false);
    expect(rejecting.moreLoadingKeys()).toBe('');
    expect((rejecting.zones.get('work_orders').data as { groups: { items: unknown[] }[] }).groups[1].items).toHaveLength(4);
    rejecting.dispose();
    const none = withMore();
    none.start();
    expect(await none.requestMore('work_orders', 'tomorrow')).toBe(false);
    none.dispose();
  });

  it('a malformed answer degrades that zone only, and still reports it was received', async () => {
    const runtime = withMore(async () => ({ state: 'rendered', as_of: null, data: 'nope' }));
    runtime.start();
    await runtime.requestMore('work_orders', 'tomorrow');
    expect(runtime.zones.get('work_orders').condition).toBe('unavailable');
    expect(runtime.zones.get('alerts').condition).toBe('rendered');
    runtime.dispose();
  });
});
