import { HistoryPayloadSchema, type HistoryRecord } from '@/contracts';
import type { HistoryChannel } from '@/clients/history/historyChannel';
import { logEvent } from '../telemetry';

// History arrives in a SUBSEQUENT pass after the main workspace renders (BRD 1.0 UR9, PT8). The list shows its loading
// state immediately and is NEVER blank between the first render and delivery (BRD 1.2 5.6 Feature 3). The canvas never
// resolves the pointer: it asks the approved channel and renders what comes back.
export type HistoryStatus = 'loading' | 'ready' | 'empty' | 'degraded' | 'error';

export interface HistoryState {
  readonly status: HistoryStatus;
  readonly records: readonly HistoryRecord[];
  readonly nextCursor: string | null;
  readonly loadingMore: boolean;
  /** Supplied by upstream when the history is partial. Never inferred. */
  readonly degradedMessage?: string;
}

const INITIAL: HistoryState = { status: 'loading', records: [], nextCursor: null, loadingMore: false };

export class HistoryHydrator {
  #state: HistoryState = INITIAL;
  #listeners = new Set<() => void>();
  #ref: string | null = null;
  #generation = 0;
  #disposed = false;

  constructor(private readonly channel: HistoryChannel) {}

  subscribe = (l: () => void): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getSnapshot = (): HistoryState => this.#state;

  /** Starts the second pass. With no pointer there is no history to deliver, which is not an error. */
  start(historyRef: string | undefined): void {
    this.#disposed = false; // a remount (React StrictMode) restarts the same hydrator
    this.#ref = historyRef ?? null;
    if (!this.#ref) return this.#set({ ...INITIAL, status: 'empty' });
    void this.#load(null, false);
  }

  /** `request-more` from HistoryList: progressive load on scroll. Ignored while loading or when there is no more. */
  requestMore(): void {
    const s = this.#state;
    if (!this.#ref || s.loadingMore || s.nextCursor === null || (s.status !== 'ready' && s.status !== 'degraded')) return;
    this.#set({ ...s, loadingMore: true });
    void this.#load(s.nextCursor, true);
  }

  retry(): void {
    if (!this.#ref) return;
    this.#set(INITIAL);
    void this.#load(null, false);
  }

  dispose(): void {
    this.#disposed = true;
    this.#generation++;
  }

  async #load(cursor: string | null, append: boolean): Promise<void> {
    const generation = ++this.#generation;
    let raw: unknown;
    try {
      raw = await this.channel.request(this.#ref as string, cursor);
    } catch {
      return this.#fail(generation, append);
    }
    if (this.#stale(generation)) return;
    const parsed = HistoryPayloadSchema.safeParse(raw);
    if (!parsed.success) return this.#fail(generation, append);

    const prior = append ? this.#state.records : [];
    const seen = new Set(prior.map((r) => r.id));
    const records = [...prior, ...parsed.data.records.filter((r) => !seen.has(r.id))];
    const degradedMessage = parsed.data.degradedMessage;
    this.#set({
      status: records.length === 0 ? 'empty' : degradedMessage ? 'degraded' : 'ready',
      records,
      nextCursor: parsed.data.nextCursor,
      loadingMore: false,
      ...(degradedMessage ? { degradedMessage } : {}),
    });
  }

  #fail(generation: number, append: boolean): void {
    if (this.#stale(generation)) return;
    logEvent('history.unavailable', 'warn', 'unavailable');
    // A failed "load more" keeps the records already shown. Only a failed first load shows the unavailable state.
    if (append) this.#set({ ...this.#state, loadingMore: false });
    else this.#set({ status: 'error', records: [], nextCursor: null, loadingMore: false });
  }

  #stale(generation: number): boolean {
    return this.#disposed || generation !== this.#generation;
  }

  #set(next: HistoryState): void {
    this.#state = next;
    for (const l of [...this.#listeners]) l();
  }
}
