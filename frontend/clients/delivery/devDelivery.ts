import { DeliveryError, type DeliveryFailureKind } from '@/contracts';
import type { ContextChannel } from '../context/contextChannel';
import type { HistoryChannel } from '../history/historyChannel';
import { sessionClient, type SessionClient } from '../session/sessionClient';
import type { DeliveryFault, DevDeliveryTarget, DevFaultControls, SourceFaults, TestSessionId } from './deliveryTypes';

// The dev delivery module (backend/context_api/handoff/FRONTEND.md section 0). It stands in for the PCR and the Streaming Canvas
// Aggregator, which in production DELIVER to the canvas. This is the ONLY file that knows the practice API's URLs. The shell imports
// the ContextChannel and HistoryChannel interfaces, never this file, so replacing it changes nothing else.
//
// It hands over the RAW payload. It does not validate, reshape or fill in anything: the shell validates, because the shell must
// survive bad payloads. It never logs a URL, header, token or body, and a failure carries only its kind.

/** A ceiling slightly above the server's own 10 s hard timeout, so a hung connection still ends in a typed failure. */
const REQUEST_CEILING_MS = 15_000;

export const DEFAULT_DELIVERY_TARGET: DevDeliveryTarget = {
  baseUrl: 'http://localhost:8000',
  tenantId: 't_acme_hvac',
  sessionId: 's_8f2',
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface DevDeliveryOptions {
  target?: Partial<DevDeliveryTarget>;
  session?: SessionClient;
  fetch?: FetchLike;
}

/** Which failure kind an HTTP status means for the context delivery, and for the history delivery (BRD section 6; guide section 8). */
export function failureKindForStatus(status: number, what: 'context' | 'history'): DeliveryFailureKind {
  if (status === 401) return 'unauthorized';
  if (status === 504) return 'timeout';
  if (status === 404) return what === 'context' ? 'role_undetermined' : 'unknown_pointer';
  return 'server_error';
}

class DevDeliveryBase {
  protected readonly target: DevDeliveryTarget;
  protected readonly session: SessionClient;
  protected readonly doFetch: FetchLike;

  constructor(options: DevDeliveryOptions = {}) {
    this.target = { ...DEFAULT_DELIVERY_TARGET, ...options.target };
    this.session = options.session ?? sessionClient;
    this.doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Which practice scenario is being delivered. The dev overlay changes this to switch persona and situation. */
  setSession(sessionId: TestSessionId): void {
    (this.target as { sessionId: TestSessionId }).sessionId = sessionId;
  }
  get sessionId(): TestSessionId {
    return this.target.sessionId;
  }

  /** GETs a sessions path and resolves the raw parsed body, or throws a DeliveryError. */
  protected async deliver(path: string, what: 'context' | 'history'): Promise<unknown> {
    const controller = new AbortController();
    const ceiling = setTimeout(() => controller.abort(), REQUEST_CEILING_MS);
    let response: Response;
    try {
      // attach() adds the session token from memory. With no session there is no Authorization header, and the server answers 401.
      const init = this.session.attach({ method: 'GET', signal: controller.signal, headers: { 'X-Tenant-Id': this.target.tenantId } });
      response = await this.doFetch(`${this.target.baseUrl}${path}`, init);
    } catch (error) {
      throw new DeliveryError(error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'unreachable');
    } finally {
      clearTimeout(ceiling);
    }
    if (!response.ok) throw new DeliveryError(failureKindForStatus(response.status, what));
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      // Not JSON at all. Handed over as the text it is, so validation rejects it as malformed. Nothing is repaired here.
      return text;
    }
  }
}

/** The context object, delivered once after login. Re-requesting it is how a refresh works until the bus exists. */
export class DevContextChannel extends DevDeliveryBase implements ContextChannel {
  request(): Promise<unknown> {
    return this.deliver(`/v1/sessions/${encodeURIComponent(this.target.sessionId)}/context`, 'context');
  }
}

/**
 * History, delivered in a second pass. The pointer comes from the context object and is passed through untouched (only
 * percent-encoded for the URL). The practice API returns the whole history in one message, so a cursor is not used.
 */
export class DevHistoryChannel extends DevDeliveryBase implements HistoryChannel {
  request(pointer: string): Promise<unknown> {
    return this.deliver(`/v1/sessions/${encodeURIComponent(this.target.sessionId)}/history/${encodeURIComponent(pointer)}`, 'history');
  }
}

/** Dev-only switches that make the practice server fail on purpose. They need the server started with OLANNAH_DEV=1. */
export class DevFaultClient implements DevFaultControls {
  readonly #base: string;
  readonly #doFetch: FetchLike;

  constructor(options: Pick<DevDeliveryOptions, 'target' | 'fetch'> = {}) {
    this.#base = (options.target?.baseUrl ?? DEFAULT_DELIVERY_TARGET.baseUrl).replace(/\/$/, '');
    this.#doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  setSourceFaults = (faults: SourceFaults): Promise<void> => this.#send('POST', '/v1/dev/faults', faults);
  resetSourceFaults = (): Promise<void> => this.#send('DELETE', '/v1/dev/faults');
  setDeliveryFault = (fault: DeliveryFault): Promise<void> => this.#send('POST', '/v1/dev/delivery', fault);
  resetDeliveryFault = (): Promise<void> => this.#send('DELETE', '/v1/dev/delivery');

  async #send(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<void> {
    const response = await this.#doFetch(`${this.#base}${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    // 404 here means the server was not started with OLANNAH_DEV=1.
    if (!response.ok) throw new Error(`dev control rejected (${response.status}): is the server running with OLANNAH_DEV=1?`);
  }
}
