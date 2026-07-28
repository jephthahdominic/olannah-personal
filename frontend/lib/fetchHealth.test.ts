import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchHealth } from './fetchHealth';

describe('fetchHealth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed health status on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response);

    const result = await fetchHealth('http://backend:8000');

    expect(result).toEqual({ status: 'ok' });
    expect(global.fetch).toHaveBeenCalledWith('http://backend:8000/health');
  });

  it('throws when the response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchHealth('http://backend:8000')).rejects.toThrow(
      'Health check failed: 500'
    );
  });
});
