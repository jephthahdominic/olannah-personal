// A reconnecting connection to the Shared Context Bus (SDD 12.4, BRD 1.0 error rows 8 and 9). It is deliberately
// independent of the transport: it is given a factory for an EventSource-like source, so the real SSE source and the
// mock source share exactly the same reconnection logic, and it is testable without a browser or a network.
//
// Behaviour:
//  - SILENCE detection: an SSE stream can be buffered by a proxy and never close, so the browser's error event alone is
//    not enough. Silence for twice the heartbeat interval counts as a disconnect.
//  - BACKOFF: 1s, 2s, 4s, 8s with jitter, capped at 30s.
//  - ESCALATION: after 3 failed attempts or 30 seconds without a connection, whichever comes first, the connection is
//    "failed" and stops retrying until the worker asks (retry()).
//  - RESUME: the last event id is offered to the next connection. Whether the bus honours it is OPEN (1.0 OQ4), so the
//    consumer must also refresh every zone after a reconnect.

export interface BusMessage {
  data: string;
  lastEventId?: string;
}

export interface EventSourceLike {
  onopen: (() => void) | null;
  onmessage: ((message: BusMessage) => void) | null;
  onerror: (() => void) | null;
  /** Present on bidirectional transports (a WebSocket). The bus itself is receive-only and does not implement it. */
  send?(data: string): void;
  close(): void;
}

export type SourceFactory = (lastEventId: string | null) => EventSourceLike;
export type BusState = 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface BusOptions {
  heartbeatMs: number;
  backoffMs: readonly number[];
  maxBackoffMs: number;
  failAfterAttempts: number;
  failAfterMs: number;
  /** 0..1, injectable so jitter is deterministic in tests. */
  random?: () => number;
}

export interface BusHandlers {
  onEvent: (data: string) => void;
  onState: (state: BusState) => void;
}

export class BusConnection {
  #state: BusState = 'connecting';
  #source: EventSourceLike | null = null;
  #lastEventId: string | null = null;
  #failed = 0;
  #everConnected = false;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #silenceTimer: ReturnType<typeof setTimeout> | null = null;
  #giveUpTimer: ReturnType<typeof setTimeout> | null = null;
  #closed = false;

  constructor(
    private readonly factory: SourceFactory,
    private readonly opts: BusOptions,
    private readonly handlers: BusHandlers,
  ) {}

  get state(): BusState {
    return this.#state;
  }
  get lastEventId(): string | null {
    return this.#lastEventId;
  }

  start(): void {
    this.#connect();
  }

  /**
   * Sends a frame on a bidirectional transport. Returns false, sending nothing, unless the connection is live: a frame is
   * never queued for later, so the worker is never told something was sent when it was not.
   */
  send(data: string): boolean {
    if (this.#state !== 'connected' || !this.#source?.send) return false;
    try {
      this.#source.send(data);
      return true;
    } catch {
      return false;
    }
  }

  /** Manual retry from the failed state: start over immediately. */
  retry(): void {
    if (this.#closed || this.#state !== 'failed') return;
    this.#failed = 0;
    this.#clearTimers();
    this.#setState('reconnecting');
    this.#armGiveUp();
    this.#connect();
  }

  close(): void {
    this.#closed = true;
    this.#clearTimers();
    this.#dropSource();
  }

  #setState(next: BusState): void {
    if (this.#state === next) return;
    this.#state = next;
    this.handlers.onState(next);
  }

  #connect(): void {
    if (this.#closed) return;
    this.#dropSource();
    const source = this.factory(this.#lastEventId);
    this.#source = source;

    source.onopen = () => {
      if (this.#source !== source) return;
      this.#everConnected = true;
      this.#failed = 0;
      this.#clearGiveUp();
      this.#setState('connected');
      this.#armSilence();
    };
    source.onmessage = (message) => {
      if (this.#source !== source) return;
      this.#armSilence(); // any message, heartbeat included, proves the stream is alive
      if (message.lastEventId) this.#lastEventId = message.lastEventId;
      if (isHeartbeat(message.data)) return;
      this.handlers.onEvent(message.data);
    };
    source.onerror = () => {
      if (this.#source !== source) return;
      this.#onDisconnect();
    };
  }

  #onDisconnect(): void {
    if (this.#closed) return;
    this.#clearSilence();
    this.#dropSource();

    const firstDrop = this.#state === 'connected' || this.#state === 'connecting';
    if (firstDrop) {
      // The drop itself is not a failed attempt. The 30 second give-up clock starts now.
      this.#setState('reconnecting');
      this.#armGiveUp();
    } else {
      this.#failed += 1;
    }

    if (this.#failed >= this.opts.failAfterAttempts) return this.#fail();
    this.#scheduleRetry();
  }

  #scheduleRetry(): void {
    const index = this.#failed; // 0 for the first retry after a drop
    const base = Math.min(this.opts.backoffMs[index] ?? this.opts.maxBackoffMs, this.opts.maxBackoffMs);
    const jitter = 1 + ((this.opts.random ?? Math.random)() * 0.4 - 0.2); // +/- 20%
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      this.#connect();
    }, Math.round(base * jitter));
  }

  #fail(): void {
    this.#clearTimers();
    this.#dropSource();
    this.#setState('failed');
  }

  #armSilence(): void {
    this.#clearSilence();
    this.#silenceTimer = setTimeout(() => this.#onDisconnect(), this.opts.heartbeatMs * 2);
  }
  #armGiveUp(): void {
    this.#clearGiveUp();
    this.#giveUpTimer = setTimeout(() => {
      if (this.#state !== 'connected') this.#fail();
    }, this.opts.failAfterMs);
  }
  #clearSilence(): void {
    if (this.#silenceTimer) clearTimeout(this.#silenceTimer);
    this.#silenceTimer = null;
  }
  #clearGiveUp(): void {
    if (this.#giveUpTimer) clearTimeout(this.#giveUpTimer);
    this.#giveUpTimer = null;
  }
  #clearTimers(): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    this.#clearSilence();
    this.#clearGiveUp();
  }
  #dropSource(): void {
    const s = this.#source;
    this.#source = null;
    if (!s) return;
    s.onopen = s.onmessage = s.onerror = null;
    s.close();
  }

  /** True once the connection has been established at least once (a drop after that is a "lost" connection). */
  get everConnected(): boolean {
    return this.#everConnected;
  }
}

function isHeartbeat(data: string): boolean {
  try {
    return (JSON.parse(data) as { type?: unknown } | null)?.type === 'heartbeat';
  } catch {
    return false;
  }
}
