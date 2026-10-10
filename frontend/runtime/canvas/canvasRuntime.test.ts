import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CanvasRuntime } from './canvasRuntime';
import { DEFAULT_RUNTIME_CONFIG } from '@/contracts';
import { technicianContext } from '@/contracts/fixtures/context';
import { technicianDashboardWithNote } from '@/contracts/fixtures/zones';
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
  const contextRequest = vi.fn(over.refresh ?? (async () => structuredClone(technicianContext)));
  const historyRequest = vi.fn(over.history ?? (async () => ({ records: [{ id: 'h1', occurredOn: '2026-09-21', title: 'Visit' }], nextCursor: null })));
  const runtime = new CanvasRuntime({
    context: technicianContext,
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
    },
    schedule: (f) => f(),
    random: () => 0.5,
  });
  const latest = () => sources[sources.length - 1];
  const render = () => runtime.zones.keys().forEach((k) => runtime.zones.markRendered(k, runtime.zones.get(k).version));
  return { runtime, sources, latest, contextRequest, historyRequest, render };
}
const flushPromises = () => vi.advanceTimersByTimeAsync(0);

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
    expect(runtime.zones.get('primary:dashboard').condition).toBe('rendered');
    expect(runtime.zones.get('context').condition).toBe('rendered');
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
    latest().onmessage!({ data: JSON.stringify({ type: 'zone.update', zoneId: 'primary:dashboard', payload: { status: 'ready', data: technicianDashboardWithNote } }) });
    const s = runtime.zones.get('primary:dashboard');
    expect((s.data as { notice?: { title: string } }).notice?.title).toBe('Store-manager update received');
    expect(s.refreshing).toBe(true);
    render();
    expect(runtime.zones.get('primary:dashboard').refreshing).toBe(false);
  });

  it('leaves the other zone alone during an update', () => {
    const { runtime, latest } = setup();
    runtime.start();
    latest().onopen!();
    const other = vi.fn();
    runtime.zones.subscribe('context')(other);
    latest().onmessage!({ data: JSON.stringify({ type: 'zone.update', zoneId: 'primary:dashboard', payload: { status: 'ready', data: technicianDashboardWithNote } }) });
    expect(other).not.toHaveBeenCalled();
  });
});

describe('CanvasRuntime: connection loss', () => {
  it('keeps the last data, marks data zones stale, and keeps writes disabled, then reconnects by itself', async () => {
    const { runtime, sources, latest } = setup();
    runtime.start();
    latest().onopen!();
    const before = runtime.zones.get('primary:dashboard').data;

    latest().onerror!();
    expect(runtime.getConnection()).toBe('reconnecting');
    expect(runtime.zones.get('primary:dashboard')).toMatchObject({ condition: 'stale' });
    expect(runtime.zones.get('primary:dashboard').data).toBe(before); // last known data preserved
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
    expect(runtime.zones.get('primary:dashboard').condition).toBe('rendered');
    expect(runtime.zones.get('primary:dashboard').refreshing).toBe(false);
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
    expect(runtime.zones.get('primary:dashboard').condition).toBe('stale');
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
    expect(runtime.zones.get('primary:dashboard')).toMatchObject({ condition: 'rendered', refreshing: true, refreshDelayed: true });
  });
});

describe('CanvasRuntime: history second pass', () => {
  it('requests history only when started, after the zones already exist, and never blocks them', async () => {
    const { runtime, historyRequest } = setup();
    expect(historyRequest).not.toHaveBeenCalled();
    expect(runtime.history.getSnapshot().status).toBe('loading');
    runtime.start();
    expect(historyRequest).toHaveBeenCalledWith(technicianContext.historyRef, null);
    await flushPromises();
    expect(runtime.history.getSnapshot().status).toBe('ready');
  });

  it('shows history as unavailable on failure while the dashboard keeps working', async () => {
    const { runtime } = setup({ history: () => Promise.reject(new Error('down')) });
    runtime.start();
    await flushPromises();
    expect(runtime.history.getSnapshot().status).toBe('error');
    expect(runtime.zones.get('primary:dashboard').condition).toBe('rendered');
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
