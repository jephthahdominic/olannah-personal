import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryHydrator } from './historyStore';
import type { HistoryChannel } from '@/clients/history/historyChannel';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';
import { rawFixture } from '@/tests/wireFixtures';

const POINTER = 'hist_s_8f2_E-2231';

function setup(handler: (pointer: string) => Promise<unknown>) {
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
    h.start(POINTER);
    expect(h.getSnapshot().status).toBe('loading');
    expect(h.getSnapshot().records).toEqual([]);
  });

  it('delivers history in a subsequent pass, with the aggregator\'s records exactly as sent', async () => {
    const message = rawFixture('history.happy') as unknown as { data: unknown[]; as_of: string };
    const { h, request } = setup(async () => message);
    h.start(POINTER);
    await tick();
    expect(h.getSnapshot()).toMatchObject({ status: 'ready', asOf: message.as_of, unavailableSources: [] });
    expect(h.getSnapshot().records).toEqual(message.data);
    // The pointer is handed on untouched. There is no cursor: the API sends the whole history at once.
    expect(request).toHaveBeenCalledWith(POINTER);
  });

  it('keeps all 28 records of a long history, with the duplicates the aggregator already absorbed', async () => {
    const { h } = setup(async () => rawFixture('history.busy'));
    h.start('hist_s_busy_E-7001');
    await tick();
    expect(h.getSnapshot().records).toHaveLength(28);
  });

  it('shows an empty state (not a blank one) when history resolved successfully with nothing in it', async () => {
    const { h } = setup(async () => rawFixture('history.clear'));
    h.start('hist_s_clear_E-5510');
    await tick();
    expect(h.getSnapshot().status).toBe('empty');
  });

  it('treats a missing pointer as nothing to deliver (no active job), not an error, and calls nothing', () => {
    const { h, request } = setup(async () => rawFixture('history.happy'));
    h.start(null);
    expect(h.getSnapshot().status).toBe('empty');
    h.start(undefined);
    expect(h.getSnapshot().status).toBe('empty');
    expect(request).not.toHaveBeenCalled();
  });

  it('shows the unavailable state on failure and logs it, without throwing', async () => {
    const { h } = setup(() => Promise.reject(new Error('down')));
    h.start(POINTER);
    await tick();
    expect(h.getSnapshot().status).toBe('error');
    expect(getBufferedEvents().map((e) => e.event)).toContain('history.unavailable');
  });

  it('treats a malformed payload as unavailable rather than rendering a guess', async () => {
    const { h } = setup(async () => rawFixture('history.malformed-zone'));
    h.start(POINTER);
    await tick();
    expect(h.getSnapshot().status).toBe('error');
  });

  it('treats an "unavailable" history as unavailable', async () => {
    const message = { ...rawFixture('history.happy'), state: 'unavailable', data: [] };
    const { h } = setup(async () => message);
    h.start(POINTER);
    await tick();
    expect(h.getSnapshot().status).toBe('error');
  });

  it('shows a partial history only when the aggregator SAYS a source was unavailable, and names it', async () => {
    const { h } = setup(async () => rawFixture('history.drive-down'));
    h.start(POINTER);
    await tick();
    expect(h.getSnapshot()).toMatchObject({ status: 'degraded', unavailableSources: ['shared_drive'] });
    const plain = setup(async () => rawFixture('history.happy'));
    plain.h.start(POINTER);
    await tick();
    expect(plain.h.getSnapshot().status).toBe('ready');
  });

  it('retry starts over from the loading state', async () => {
    let calls = 0;
    const { h } = setup(async () => {
      if (++calls === 1) throw new Error('down');
      return rawFixture('history.happy');
    });
    h.start(POINTER);
    await tick();
    expect(h.getSnapshot().status).toBe('error');
    h.retry();
    expect(h.getSnapshot().status).toBe('loading');
    await tick();
    expect(h.getSnapshot().status).toBe('ready');
  });

  it('retry does nothing when there was no pointer', () => {
    const { h, request } = setup(async () => rawFixture('history.happy'));
    h.start(null);
    h.retry();
    expect(request).not.toHaveBeenCalled();
  });

  it('ignores a late answer after dispose', async () => {
    let resolve!: (v: unknown) => void;
    const { h } = setup(() => new Promise((r) => (resolve = r)));
    h.start(POINTER);
    h.dispose();
    resolve(rawFixture('history.happy'));
    await tick();
    expect(h.getSnapshot().status).toBe('loading');
  });
});
