import type { BusMessage, EventSourceLike, SourceFactory } from '../bus/busConnection';

// A mock assistant: a bidirectional source plus controls, so the panel, its connection states and PROACTIVE messages can be
// exercised without the intelligence layer. Replies are clearly labelled as mock text; nothing here pretends to be real.
class MockAssistantSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((message: BusMessage) => void) | null = null;
  onerror: (() => void) | null = null;
  #open: ReturnType<typeof setTimeout> | null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #n = 0;

  constructor() {
    this.#open = setTimeout(() => {
      this.#open = null;
      if (mockAssistantControl.failConnects > 0) {
        mockAssistantControl.failConnects -= 1;
        this.onerror?.();
        return;
      }
      this.onopen?.();
      this.#heartbeat = setInterval(() => this.onmessage?.({ data: JSON.stringify({ type: 'heartbeat' }) }), mockAssistantControl.heartbeatMs);
    }, 50);
  }

  send(data: string): void {
    let text = '';
    try {
      text = (JSON.parse(data) as { text?: string }).text ?? '';
    } catch {
      return;
    }
    setTimeout(() => this.deliver({ text: `(mock assistant) I received: "${text}"` }), mockAssistantControl.replyDelayMs);
  }

  deliver(turn: { text: string; proactive?: boolean }): void {
    this.#n += 1;
    this.onmessage?.({ data: JSON.stringify({ type: 'message', turn: { id: `a-${Date.now()}-${this.#n}`, role: 'assistant', ...turn } }) });
  }
  fail(): void {
    this.onerror?.();
  }
  close(): void {
    if (this.#open) clearTimeout(this.#open);
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    mockAssistantControl.sources.delete(this);
  }
}

export const mockAssistantControl = {
  sources: new Set<MockAssistantSource>(),
  failConnects: 0,
  heartbeatMs: 5_000,
  replyDelayMs: 300,
  /** The assistant speaks first, from live activity (BRD 1.0 OQ9: bidirectional and proactive). */
  speak(text: string): void {
    for (const s of this.sources) s.deliver({ text, proactive: true });
  },
  drop(): void {
    for (const s of [...this.sources]) s.fail();
  },
  reset(): void {
    this.sources.clear();
    this.failConnects = 0;
  },
};

export const createMockAssistantSource: SourceFactory = () => {
  const s = new MockAssistantSource();
  mockAssistantControl.sources.add(s);
  return s;
};
