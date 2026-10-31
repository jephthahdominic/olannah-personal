import { validateWireHistory, type Wire } from '@/contracts';
import type { HistoryChannel } from '@/clients/history/historyChannel';
import { logEvent } from '../telemetry';

// History arrives in a SUBSEQUENT pass after the main workspace renders (BRD 1.0 UR9, PT8). The list shows its loading
// state immediately and is NEVER blank between the first render and delivery (BRD 1.2 5.6 Feature 3). The canvas never
// resolves the pointer: it hands the opaque pointer to the approved channel and renders what comes back.
export type HistoryStatus = 'loading' | 'ready' | 'empty' | 'degraded' | 'error';

export interface HistoryState {
  readonly status: HistoryStatus;
  readonly records: readonly Wire.HistoryRecord[];
  /** Sources the aggregator could not read, so the history may be partial. Supplied, never inferred. */
  readonly unavailableSources: readonly string[];
  /** How old the history is, as delivered. Shown, never judged. */
  readonly asOf: string | null;
}

const INITIAL: HistoryState = { status: 'loading', records: [], unavailableSources: [], asOf: null };

export class HistoryHydrator {
  #state: HistoryState = INITIAL;
  #listeners = new Set<() => void>();
  #pointer: string | null = null;
  #generation = 0;
  #disposed = false;

  constructor(private readonly channel: HistoryChannel) {}

  subscribe = (l: () => void): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getSnapshot = (): HistoryState => this.#state;

  /** Starts the second pass. With no pointer there is no history to deliver (no active job), which is not an error. */
  start(pointer: string | null | undefined): void {
    this.#disposed = false; // a remount (React StrictMode) restarts the same hydrator
    this.#pointer = pointer ?? null;
    if (!this.#pointer) return this.#set({ ...INITIAL, status: 'empty' });
    void this.#load();
  }

  retry(): void {
    if (!this.#pointer) return;
    this.#set(INITIAL);
    void this.#load();
  }

  dispose(): void {
    this.#disposed = true;
    this.#generation++;
  }

  async #load(): Promise<void> {
    const generation = ++this.#generation;
    let raw: unknown;
    try {
      raw = await this.channel.request(this.#pointer as string);
    } catch {
      return this.#fail(generation);
    }
    if (this.#stale(generation)) return;
    const result = validateWireHistory(raw);
    // A malformed history payload degrades the history zone only.
    if (result.kind !== 'ok') return this.#fail(generation);
    const { message } = result;
    if (message.state === 'unavailable') return this.#fail(generation);
    this.#set({
      // Rendered with no records is a valid empty history, never an error.
      status: message.data.length === 0 ? 'empty' : message.data_quality.unavailable_sources.length > 0 ? 'degraded' : 'ready',
      records: message.data,
      unavailableSources: message.data_quality.unavailable_sources,
      asOf: message.as_of,
    });
  }

  #fail(generation: number): void {
    if (this.#stale(generation)) return;
    logEvent('history.unavailable', 'warn', 'unavailable');
    this.#set({ ...INITIAL, status: 'error' });
  }

  #stale(generation: number): boolean {
    return this.#disposed || generation !== this.#generation;
  }

  #set(next: HistoryState): void {
    this.#state = next;
    for (const l of [...this.#listeners]) l();
  }
}
