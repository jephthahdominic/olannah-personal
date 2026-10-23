import type { BusMessage, EventSourceLike, SourceFactory } from '../bus/busConnection';

// The real assistant transport: a WebSocket (BRD 1.0 OQ9). The URL and authentication are OPEN (SDD K6). A browser WebSocket
// cannot set request headers, so authentication here is by HttpOnly, Secure, SameSite cookie on the upgrade request. The
// canvas never holds the token for this channel. Reconnection is owned by BusConnection, so this source closes itself on error.
class NotConfiguredSocket implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((message: BusMessage) => void) | null = null;
  onerror: (() => void) | null = null;
  #t = setTimeout(() => this.onerror?.(), 0);
  close(): void {
    clearTimeout(this.#t);
  }
}

class RealSocket implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((message: BusMessage) => void) | null = null;
  onerror: (() => void) | null = null;
  #ws: WebSocket;

  constructor(url: string) {
    this.#ws = new WebSocket(url);
    this.#ws.onopen = () => this.onopen?.();
    this.#ws.onmessage = (e) => this.onmessage?.({ data: typeof e.data === 'string' ? e.data : '' });
    this.#ws.onerror = () => this.onerror?.();
    this.#ws.onclose = () => this.onerror?.();
  }
  send(data: string): void {
    this.#ws.send(data);
  }
  close(): void {
    this.#ws.onopen = this.#ws.onmessage = this.#ws.onerror = this.#ws.onclose = null;
    this.#ws.close();
  }
}

export const createRealAssistantSource: SourceFactory = () => {
  const url = process.env.NEXT_PUBLIC_ASSISTANT_URL;
  if (!url) return new NotConfiguredSocket();
  const target = new URL(url, window.location.origin);
  // Never downgrade to an unencrypted socket from an HTTPS page.
  target.protocol = target.protocol === 'http:' ? 'ws:' : target.protocol === 'https:' ? 'wss:' : target.protocol;
  return new RealSocket(target.toString());
};
