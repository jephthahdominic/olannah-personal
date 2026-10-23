import { vi } from 'vitest';
import { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import { DEFAULT_RUNTIME_CONFIG, type ContextEnvelope } from '@/contracts';
import { technicianContext } from '@/contracts/fixtures/context';
import type { EventSourceLike } from '@/clients/bus/busConnection';

export class FakeSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string; lastEventId?: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  fail() {
    this.onerror?.();
  }
  send(event: unknown) {
    this.onmessage?.({ data: typeof event === 'string' ? event : JSON.stringify(event) });
  }

}

/** A bidirectional source (the assistant WebSocket): `emit` simulates a frame arriving, `send` records what the canvas sent. */
export class FakeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  outbound: string[] = [];
  close() {
    this.closed = true;
  }
  send(data: string) {
    this.outbound.push(data);
  }
  open() {
    this.onopen?.();
  }
  fail() {
    this.onerror?.();
  }
  emit(event: unknown) {
    this.onmessage?.({ data: typeof event === 'string' ? event : JSON.stringify(event) });
  }
}

export interface RuntimeHarness {
  runtime: CanvasRuntime;
  sources: FakeSource[];
  latest: () => FakeSource;
  /** The assistant WebSocket sources, separate from the bus. */
  assistantSources: FakeSocket[];
  assistant: () => FakeSocket;
  feedbackSubmit: ReturnType<typeof vi.fn>;
  contextRequest: ReturnType<typeof vi.fn>;
  historyRequest: ReturnType<typeof vi.fn>;
  /** Runs the held coalescing frame, applying whatever the pipeline has queued. */
  flush: () => void;
}

/** A runtime wired to fakes. It is NOT started: tests start it when they want a connection. */
export function makeRuntime(
  context: ContextEnvelope = technicianContext,
  over: { history?: () => Promise<unknown>; refresh?: () => Promise<unknown>; autoSchedule?: boolean; persistenceElected?: string[]; feedback?: () => Promise<boolean> } = {},
): RuntimeHarness {
  const sources: FakeSource[] = [];
  const assistantSources: FakeSocket[] = [];
  const feedbackSubmit = vi.fn(over.feedback ?? (async () => true));
  const contextRequest = vi.fn(over.refresh ?? (async () => structuredClone(context)));
  const historyRequest = vi.fn(
    over.history ??
      (async () => ({
        records: [
          { id: 'h1', occurredOn: '2026-09-21', title: 'Slow recovery after delivery', summary: 'No parts used.' },
          { id: 'h2', occurredOn: '2026-09-04', title: 'Evaporator ice cleared' },
        ],
        nextCursor: null,
      })),
  );
  let frame: (() => void) | null = null;
  const runtime = new CanvasRuntime({
    context,
    session: { userId: 'u', tenantId: 't', resolvedRole: context.resolvedRole },
    config: { ...DEFAULT_RUNTIME_CONFIG, bus: { ...DEFAULT_RUNTIME_CONFIG.bus, heartbeatMs: 3_600_000 }, persistence: { elected: over.persistenceElected ?? ['AssistantPanel'] } },
    upstream: {
      context: { request: contextRequest },
      history: { request: historyRequest },
      createBusSource: () => {
        const s = new FakeSource();
        sources.push(s);
        return s;
      },
      createAssistantSource: () => {
        const s = new FakeSocket();
        assistantSources.push(s);
        return s;
      },
      feedback: { submit: feedbackSubmit },
    },
    schedule: over.autoSchedule === false ? (f) => (frame = f) : (f) => f(),
    random: () => 0.5,
  });
  return {
    runtime,
    sources,
    assistantSources,
    assistant: () => assistantSources[assistantSources.length - 1],
    feedbackSubmit,
    latest: () => sources[sources.length - 1],
    contextRequest,
    historyRequest,
    flush: () => {
      const f = frame;
      frame = null;
      f?.();
    },
  };
}
