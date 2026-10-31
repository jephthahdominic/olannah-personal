import { describe, it, expect, vi } from 'vitest';
import { isDeliveryError } from '@/contracts';
import { SessionClient } from '../session/sessionClient';
import { DevContextChannel, DevFaultClient, DevHistoryChannel, failureKindForStatus } from './devDelivery';

const session = () => {
  const c = new SessionClient();
  c.set({ userId: 'u', resolvedRole: 'technician', tenantId: 't', sessionToken: 'secret-token' });
  return c;
};
// A fresh Response per call: a body can only be read once.
const reply = (status: number, body: unknown = {}) => vi.fn().mockImplementation(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return isDeliveryError(e) ? e.kind : 'not-a-delivery-error';
  }
  return 'resolved';
};

describe('DevContextChannel', () => {
  it('asks for the practice session context with the session token and tenant, and nothing else', async () => {
    const fetch = reply(200, { schema_version: '1.0' });
    await new DevContextChannel({ fetch, session: session(), target: { sessionId: 's_busy' } }).request();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/v1/sessions/s_busy/context');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
    expect(headers.get('X-Tenant-Id')).toBe('t_acme_hvac');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('hands over the raw body untouched: no validation, no reshaping, no defaults', async () => {
    const body = { schema_version: '9.9', whatever: [1, 2], nested: { a: null } };
    expect(await new DevContextChannel({ fetch: reply(200, body), session: session() }).request()).toEqual(body);
  });

  it('hands over a body that is not JSON as text, for validation to reject, rather than failing or repairing it', async () => {
    expect(await new DevContextChannel({ fetch: reply(200, 'not json{'), session: session() }).request()).toBe('not json{');
  });

  it.each([
    [401, 'unauthorized'],
    [404, 'role_undetermined'],
    [504, 'timeout'],
    [500, 'server_error'],
    [502, 'server_error'],
    [422, 'server_error'],
  ])('status %i is the typed failure "%s"', async (status, kind) => {
    expect(await kindOf(new DevContextChannel({ fetch: reply(status), session: session() }).request())).toBe(kind);
  });

  it('a network failure is "unreachable"', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await kindOf(new DevContextChannel({ fetch, session: session() }).request())).toBe('unreachable');
  });

  it('an aborted request is "timeout"', async () => {
    const fetch = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    expect(await kindOf(new DevContextChannel({ fetch, session: session() }).request())).toBe('timeout');
  });

  it('with no session there is no Authorization header, so the server answers 401 and the worker stays on the loading screen', async () => {
    const fetch = reply(401);
    expect(await kindOf(new DevContextChannel({ fetch, session: new SessionClient() }).request())).toBe('unauthorized');
    expect(new Headers(fetch.mock.calls[0][1].headers).has('Authorization')).toBe(false);
  });

  it('a failure carries only its kind: no URL, token or body can reach a log', async () => {
    try {
      await new DevContextChannel({ fetch: reply(500, { detail: 'secret-token leaked' }), session: session() }).request();
    } catch (e) {
      expect(JSON.stringify({ message: (e as Error).message, ...(e as object) })).not.toMatch(/secret-token|localhost|leaked/);
    }
  });

  it('can switch practice scenario without being rebuilt', async () => {
    const fetch = reply(200, {});
    const channel = new DevContextChannel({ fetch, session: session() });
    channel.setSession('s_nojob');
    await channel.request();
    expect(fetch.mock.calls[0][0]).toContain('/sessions/s_nojob/');
  });
});

describe('DevHistoryChannel', () => {
  it('passes the pointer through untouched (only percent-encoded), never building or editing it', async () => {
    const fetch = reply(200, {});
    await new DevHistoryChannel({ fetch, session: session() }).request('hist_s_8f2_E-2231');
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:8000/v1/sessions/s_8f2/history/hist_s_8f2_E-2231');
    await new DevHistoryChannel({ fetch, session: session() }).request('a/b c');
    expect(fetch.mock.calls[1][0]).toContain('/history/a%2Fb%20c');
  });

  it.each([
    [404, 'unknown_pointer'],
    [401, 'unauthorized'],
    [504, 'timeout'],
    [500, 'server_error'],
  ])('status %i is "%s"', async (status, kind) => {
    expect(await kindOf(new DevHistoryChannel({ fetch: reply(status), session: session() }).request('p'))).toBe(kind);
  });
});

describe('failureKindForStatus', () => {
  it('a 404 means different things for the two deliveries', () => {
    expect(failureKindForStatus(404, 'context')).toBe('role_undetermined');
    expect(failureKindForStatus(404, 'history')).toBe('unknown_pointer');
  });
});

describe('DevFaultClient', () => {
  it('sends each practice-server switch with the documented method, path and body', async () => {
    const fetch = reply(200);
    const faults = new DevFaultClient({ fetch });
    await faults.setSourceFaults({ sitedocs: 'down', xoi: 'down' });
    await faults.resetSourceFaults();
    await faults.setDeliveryFault({ delay_seconds: 2 });
    await faults.setDeliveryFault({ payload: 'malformed_zone' });
    await faults.resetDeliveryFault();
    const sent = fetch.mock.calls.map(([url, init]) => [init.method, url.replace('http://localhost:8000', ''), init.body]);
    expect(sent).toEqual([
      ['POST', '/v1/dev/faults', '{"sitedocs":"down","xoi":"down"}'],
      ['DELETE', '/v1/dev/faults', undefined],
      ['POST', '/v1/dev/delivery', '{"delay_seconds":2}'],
      ['POST', '/v1/dev/delivery', '{"payload":"malformed_zone"}'],
      ['DELETE', '/v1/dev/delivery', undefined],
    ]);
    expect(new Headers(fetch.mock.calls[0][1].headers).get('Content-Type')).toBe('application/json');
  });

  it('says so plainly when the server is not in dev mode', async () => {
    await expect(new DevFaultClient({ fetch: reply(404) }).resetSourceFaults()).rejects.toThrow(/OLANNAH_DEV=1/);
  });
});
