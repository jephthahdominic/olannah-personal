import type { BusMessage, EventSourceLike, SourceFactory } from './busConnection';

// The real SSE transport. The bus URL and its authentication are OPEN (BRD 1.0 OQ4, SDD K3). A browser EventSource cannot
// set request headers, so authentication here is by HttpOnly, Secure, SameSite cookie (`withCredentials`). If the bus
// authenticates by header instead, replace this with a fetch-based stream reader.
//
// Browsers reconnect an EventSource on their own, but BusConnection owns reconnection (backoff, escalation, silence
// detection), so this source closes itself on error and lets BusConnection decide.
class NotConfiguredSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((message: BusMessage) => void) | null = null;
  onerror: (() => void) | null = null;
  #t = setTimeout(() => this.onerror?.(), 0);
  close(): void {
    clearTimeout(this.#t);
  }
}

class RealBusSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((message: BusMessage) => void) | null = null;
  onerror: (() => void) | null = null;
  #es: EventSource;

  constructor(url: string) {
    this.#es = new EventSource(url, { withCredentials: true });
    this.#es.onopen = () => this.onopen?.();
    this.#es.onmessage = (e) => this.onmessage?.({ data: e.data, lastEventId: e.lastEventId || undefined });
    // Named heartbeat events are the only way a browser can observe liveness (SSE comments are invisible to JavaScript).
    this.#es.addEventListener('heartbeat', () => this.onmessage?.({ data: JSON.stringify({ type: 'heartbeat' }) }));
    this.#es.onerror = () => {
      this.#es.close();
      this.onerror?.();
    };
  }
  close(): void {
    this.#es.close();
  }
}

export const createRealBusSource: SourceFactory = (lastEventId) => {
  const base = process.env.NEXT_PUBLIC_BUS_URL;
  if (!base) return new NotConfiguredSource();
  const url = new URL(base, window.location.origin);
  if (lastEventId) url.searchParams.set('lastEventId', lastEventId);
  return new RealBusSource(url.toString());
};
