import { validateContext } from '@/contracts';
import { startDeadline } from '../timers/deadline';
import { logEvent } from '../telemetry';
import type { ZoneStore } from '../zones/zoneStore';
import type { UpdatePipeline } from './updatePipeline';

// Automatic refresh every 5 minutes regardless of whether a trigger event fired (BRD 1.0 UR6D, provisional), and a
// refresh of every zone after a reconnect (events may have been missed, SDD 12.4). The canvas never calls the PCR: it
// asks the context channel to re-deliver the context object (BRD 1.0 non-goal 4, SDD 5.3 design note).
//
// A re-delivery is fed through the SAME update pipeline as a bus event, so it gets the same indicator, the same 30
// second warning and the same render confirmation. Open question (1.0 OQ10): whether the 5-minute timer triggers a full
// PCR re-resolution or a lightweight cache check. The canvas treats the answer as an ordinary context update.
export interface RefreshDeps {
  store: ZoneStore;
  pipeline: UpdatePipeline;
  /** Resolves with the RAW re-delivered context object. Rejection leaves zones refreshing until the warning fires. */
  requestContext: () => Promise<unknown>;
  autoIntervalMs: number;
  isBlocked?: () => boolean;
  now?: () => number;
}

export class RefreshManager {
  #cancel: (() => void) | null = null;
  #disposed = false;
  #deferred = false;

  constructor(private readonly deps: RefreshDeps) {}

  start(): void {
    this.#arm();
  }

  /** Refreshes every zone now: a reconnect, an automatic tick, or a manual request. */
  async refreshAll(): Promise<void> {
    if (this.#disposed) return;
    if (this.deps.isBlocked?.()) {
      this.#deferred = true; // pauses while a checkpoint is active, resumes on restoration
      return;
    }
    const keys = this.deps.store.keys();
    for (const key of keys) this.deps.pipeline.beginRefresh(key);

    let raw: unknown;
    try {
      raw = await this.deps.requestContext();
    } catch {
      return; // the indicator becomes a warning at 30 seconds; the last data stays on screen
    }
    if (this.#disposed) return;
    const result = validateContext(raw);
    if (result.kind !== 'ok') return; // a bad re-delivery changes nothing the worker can see
    const delivered = result.context.zones;
    for (const key of keys) {
      if (key in delivered) this.deps.pipeline.receiveZone(key, delivered[key]);
      else this.deps.pipeline.endRefresh(key); // nothing new for this zone
    }
  }

  /** The checkpoint ended: run anything that was held back. */
  resume(): void {
    if (this.#deferred) {
      this.#deferred = false;
      void this.refreshAll();
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#cancel?.();
    this.#cancel = null;
  }

  #arm(): void {
    this.#cancel?.();
    this.#cancel = startDeadline(
      this.deps.autoIntervalMs,
      () => {
        if (this.#disposed) return;
        logEvent('refresh.auto', 'info');
        void this.refreshAll();
        this.#arm();
      },
      this.deps.now,
    );
  }
}
