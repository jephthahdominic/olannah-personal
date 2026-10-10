import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryHydrator } from './historyStore';
import type { HistoryChannel } from '@/clients/history/historyChannel';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';

const rec = (id: string) => ({ id, occurredOn: '2026-09-21', title: `Visit ${id}` });
const page = (ids: string[], nextCursor: string | null, extra = {}) => ({ records: ids.map(rec), nextCursor, ...extra });

function setup(handler: (ref: string, cursor: string | null) => Promise<unknown>) {
  const request = vi.fn(handler);
  const h = new HistoryHydrator({ request } as HistoryChannel);
  return { h, request };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => clearTelemetryBuffer());

describe('HistoryHydrator (BRD 1.0 UR9, 1.2 5.6 Feature 3)', () => {
  it('starts in the loading state, so the list is never blank before delivery', () => {
    const { h } = setup(() => new Promise(() => {}));
    expect(h.getSnapshot().status).toBe('loading');
    h.start('ref-1');
    expect(h.getSnapshot().status).toBe('loading');
    expect(h.getSnapshot().records).toEqual([]);
  });

  it('delivers history in a subsequent pass and leaves the loading state', async () => {
    const { h, request } = setup(async () => page(['a', 'b'], null));
    h.start('ref-1');
    await tick();
    expect(h.getSnapshot()).toMatchObject({ status: 'ready', records: [rec('a'), rec('b')], nextCursor: null });
    expect(request).toHaveBeenCalledWith('ref-1', null);
  });

  it('shows an empty state (not a blank one) when history resolved successfully with nothing in it', async () => {
    const { h } = setup(async () => page([], null));
    h.start('ref-1');
    await tick();
    expect(h.getSnapshot().status).toBe('empty');
  });

  it('treats a missing pointer as nothing to deliver, not an error, and calls nothing', () => {
    const { h, request } = setup(async () => page([], null));
    h.start(undefined);
    expect(h.getSnapshot().status).toBe('empty');
    expect(request).not.toHaveBeenCalled();
  });

  it('shows the unavailable state on failure and logs it, without throwing', async () => {
    const { h } = setup(() => Promise.reject(new Error('down')));
    h.start('ref-1');
    await tick();
    expect(h.getSnapshot().status).toBe('error');
    expect(getBufferedEvents().map((e) => e.event)).toContain('history.unavailable');
  });

  it('treats a malformed payload as unavailable rather than rendering a guess', async () => {
    const { h } = setup(async () => ({ records: 'nope' }));
    h.start('ref-1');
    await tick();
    expect(h.getSnapshot().status).toBe('error');
  });

  it('shows a degraded state only when upstream SUPPLIES the degradation message', async () => {
    const { h } = setup(async () => page(['a'], null, { degradedMessage: 'Some older records could not be loaded.' }));
    h.start('ref-1');
    await tick();
    expect(h.getSnapshot()).toMatchObject({ status: 'degraded', degradedMessage: 'Some older records could not be loaded.' });
    const plain = setup(async () => page(['a'], null));
    plain.h.start('ref-1');
    await tick();
    expect(plain.h.getSnapshot().status).toBe('ready');
  });

  it('loads more on request, appends in order, and de-duplicates by id', async () => {
    const { h, request } = setup(async (_ref, cursor) => (cursor === null ? page(['a', 'b'], '2') : page(['b', 'c'], null)));
    h.start('ref-1');
    await tick();
    h.requestMore();
    expect(h.getSnapshot().loadingMore).toBe(true);
    await tick();
    expect(h.getSnapshot().records.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(h.getSnapshot()).toMatchObject({ loadingMore: false, nextCursor: null });
    expect(request).toHaveBeenLastCalledWith('ref-1', '2');
  });

  it('ignores request-more while a page is loading, when there is no more, and before the first page', async () => {
    const { h, request } = setup(async () => page(['a'], null));
    h.requestMore(); // before the first page
    h.start('ref-1');
    h.requestMore(); // still loading
    await tick();
    h.requestMore(); // no more pages
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps the records already shown when a later page fails', async () => {
    let calls = 0;
    const { h } = setup(async () => {
      if (++calls === 1) return page(['a', 'b'], '2');
      throw new Error('down');
    });
    h.start('ref-1');
    await tick();
    h.requestMore();
    await tick();
    expect(h.getSnapshot()).toMatchObject({ status: 'ready', loadingMore: false });
    expect(h.getSnapshot().records.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('retry starts over from the loading state', async () => {
    let calls = 0;
    const { h } = setup(async () => {
      if (++calls === 1) throw new Error('down');
      return page(['a'], null);
    });
    h.start('ref-1');
    await tick();
    expect(h.getSnapshot().status).toBe('error');
    h.retry();
    expect(h.getSnapshot().status).toBe('loading');
    await tick();
    expect(h.getSnapshot().status).toBe('ready');
  });

  it('ignores a late answer after dispose', async () => {
    let resolve!: (v: unknown) => void;
    const { h } = setup(() => new Promise((r) => (resolve = r)));
    h.start('ref-1');
    h.dispose();
    resolve(page(['a'], null));
    await tick();
    expect(h.getSnapshot().status).toBe('loading');
  });
});
