import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RefreshManager } from './refreshManager';
import { UpdatePipeline } from './updatePipeline';
import { ZoneStore } from '../zones/zoneStore';
import { technicianContext } from '@/contracts/fixtures/context';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';

const ctxPayload = (title: string) => ({ status: 'ready', data: { kind: 'context', title, lines: [], historyTitle: 'History' } });
const contextWith = (zones: Record<string, unknown>) => ({ ...technicianContext, zones });

function setup(requestContext: () => Promise<unknown>, isBlocked?: () => boolean) {
  const store = new ZoneStore();
  store.initialize(['primary:dashboard', 'context'], { 'primary:dashboard': { status: 'ready' }, context: ctxPayload('Before') });
  const pipeline = new UpdatePipeline({ store, stalenessWarnMs: 30_000, schedule: (f) => f(), isBlocked });
  const manager = new RefreshManager({ store, pipeline, requestContext, autoIntervalMs: 300_000, isBlocked });
  const render = () => store.keys().forEach((k) => store.markRendered(k, store.get(k).version));
  return { store, pipeline, manager, render };
}

beforeEach(() => {
  vi.useFakeTimers();
  clearTelemetryBuffer();
});
afterEach(() => vi.useRealTimers());

describe('RefreshManager (BRD 1.0 UR6D, SDD 7.7)', () => {
  it('refreshes automatically every 5 minutes with no trigger event, and keeps doing so', async () => {
    const request = vi.fn().mockResolvedValue(contextWith({}));
    const t = setup(request);
    t.manager.start();
    await vi.advanceTimersByTimeAsync(299_999);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(request).toHaveBeenCalledTimes(2);
    expect(getBufferedEvents().filter((e) => e.event === 'refresh.auto')).toHaveLength(2);
    t.manager.dispose();
  });

  it('marks every zone refreshing at once, then applies the re-delivered zones through the normal pipeline', async () => {
    let resolve!: (v: unknown) => void;
    const t = setup(() => new Promise((r) => (resolve = r)));
    const pending = t.manager.refreshAll();
    expect(t.store.get('context').refreshing).toBe(true);
    expect(t.store.get('primary:dashboard').refreshing).toBe(true);
    resolve(contextWith({ context: ctxPayload('After'), 'primary:dashboard': { status: 'ready' } }));
    await pending;
    expect((t.store.get('context').data as { title: string }).title).toBe('After');
    expect(t.store.get('context').refreshing).toBe(true); // still waiting for the render confirmation
    t.render();
    expect(t.store.get('context').refreshing).toBe(false);
  });

  it('clears the indicator for a zone the re-delivery had nothing new for', async () => {
    const t = setup(() => Promise.resolve(contextWith({ context: ctxPayload('After') })));
    await t.manager.refreshAll();
    expect(t.store.get('primary:dashboard').refreshing).toBe(false);
  });

  it('keeps the last known data and warns at 30 seconds if the channel never answers, without blocking', async () => {
    const t = setup(() => new Promise(() => {}));
    void t.manager.refreshAll();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(t.store.get('context')).toMatchObject({ condition: 'rendered', refreshing: true, refreshDelayed: true });
    expect((t.store.get('context').data as { title: string }).title).toBe('Before');
  });

  it('keeps the last known data when the channel rejects', async () => {
    const t = setup(() => Promise.reject(new Error('down')));
    await t.manager.refreshAll();
    expect((t.store.get('context').data as { title: string }).title).toBe('Before');
    expect(t.store.get('context').refreshing).toBe(true);
  });

  it('changes nothing visible when the re-delivered context is itself bad (wrong version, malformed)', async () => {
    for (const bad of [{ ...technicianContext, schemaVersion: '99.0' }, { nope: true }, null]) {
      const t = setup(() => Promise.resolve(bad));
      await t.manager.refreshAll();
      expect((t.store.get('context').data as { title: string }).title).toBe('Before');
      expect(t.store.get('context').condition).toBe('rendered');
    }
  });

  it('pauses while a checkpoint is active and runs the held refresh when it ends', async () => {
    let blocked = true;
    const request = vi.fn().mockResolvedValue(contextWith({}));
    const t = setup(request, () => blocked);
    await t.manager.refreshAll();
    expect(request).not.toHaveBeenCalled();
    expect(t.store.get('context').refreshing).toBe(false);
    blocked = false;
    t.manager.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops refreshing after dispose', async () => {
    const request = vi.fn().mockResolvedValue(contextWith({}));
    const t = setup(request);
    t.manager.start();
    t.manager.dispose();
    await vi.advanceTimersByTimeAsync(900_000);
    expect(request).not.toHaveBeenCalled();
  });
});
