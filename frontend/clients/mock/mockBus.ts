import type { BusMessage, EventSourceLike, SourceFactory } from '../bus/busConnection';

// A mock Shared Context Bus: an EventSource-like source plus a control panel, so reconnection, staleness, live updates and
// the escalation to a failed state can all be exercised without a backend (SDD 12.5 fault injection). It goes through
// the SAME BusConnection as the real source, so the reconnection logic under test is the production logic.
class MockBusSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((message: BusMessage) => void) | null = null;
  onerror: (() => void) | null = null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #open: ReturnType<typeof setTimeout> | null = null;
  #seq = 0;

  constructor() {
    this.#open = setTimeout(() => {
      this.#open = null;
      if (mockBusControl.failConnects > 0) {
        mockBusControl.failConnects -= 1;
        this.onerror?.();
        return;
      }
      this.onopen?.();
      this.#heartbeat = setInterval(() => this.emit({ type: 'heartbeat' }), mockBusControl.heartbeatMs);
    }, 50);
  }

  emit(event: unknown): void {
    this.#seq += 1;
    this.onmessage?.({ data: JSON.stringify(event), lastEventId: `mock-${this.#seq}` });
  }
  fail(): void {
    this.onerror?.();
  }
  close(): void {
    if (this.#open) clearTimeout(this.#open);
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    mockBusControl.sources.delete(this);
  }
}

export const mockBusControl = {
  sources: new Set<MockBusSource>(),
  /** The next N connection attempts fail. Set above the escalation limit to reach the "reconnection failed" banner. */
  failConnects: 0,
  heartbeatMs: 5_000,
  /** Sends an event to the live connection. */
  emit(event: unknown): void {
    for (const s of this.sources) s.emit(event);
  },
  /** Drops the live connection (a lost network). The connection then reconnects by itself. */
  drop(): void {
    for (const s of [...this.sources]) s.fail();
  },
  reset(): void {
    this.sources.clear();
    this.failConnects = 0;
    this.heartbeatMs = 5_000;
  },
};

export const createMockBusSource: SourceFactory = () => {
  const source = new MockBusSource();
  mockBusControl.sources.add(source);
  return source;
};
