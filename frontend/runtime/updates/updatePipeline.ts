import { BusEventSchema, type ZonePayload } from '@/contracts';
import { startDeadline } from '../timers/deadline';
import { logEvent } from '../telemetry';
import { isKnownZoneKey } from '../zones/zoneKeys';
import { validateZonePayload, type ZoneStore } from '../zones/zoneStore';

// Every bus event passes through the same pipeline (SDD 7.5), which is where the 400ms zone re-render target is won
// or lost. Steps:
//   1 receive and validate  ->  2 gate on checkpoint (queue)  ->  3 coalesce within one frame
//   ->  4 mark refreshing IMMEDIATELY  ->  5 apply (in a low-priority transition)  ->  6 confirm render, then clear.
// The indicator never clears before the new data is on screen (BRD 1.0 UR7C): that is a test failure, not a nicety.

export interface PipelineDeps {
  store: ZoneStore;
  /** Warn after this long without a rendered update (BRD 1.0 UR7B, provisional 30s). */
  stalenessWarnMs: number;
  /** True while a checkpoint is active. Updates queue and never change the checkpoint surface (BRD 1.0 UR12). */
  isBlocked?: () => boolean;
  /** The coalescing window. Defaults to one animation frame. */
  schedule?: (flush: () => void) => void;
  /** Wraps the store write so React can treat it as low priority. Defaults to calling it directly. */
  applyBatch?: (apply: () => void) => void;
  now?: () => number;
  /** Receives timing for every rendered update, so performance can be asserted (target under 400ms P95). */
  onMetric?: (metric: { zoneKey: string; receivedToRenderedMs: number }) => void;
}

const nextFrame = (flush: () => void) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => flush());
  else setTimeout(flush, 16);
};

export class UpdatePipeline {
  #store: ZoneStore;
  #opts: PipelineDeps;
  #lastSeq = new Map<string, number>();
  #pending = new Map<string, ZonePayload>();
  #queued: { key: string; payload: unknown }[] = [];
  #flushScheduled = false;
  #warnTimers = new Map<string, () => void>();
  #awaiting = new Map<string, { version: number; receivedAt: number }>();
  #receivedAt = new Map<string, number>();
  #unsubscribe: () => void;
  #disposed = false;

  constructor(opts: PipelineDeps) {
    this.#opts = opts;
    this.#store = opts.store;
    this.#unsubscribe = opts.store.onRendered((key, version) => this.#confirm(key, version));
  }

  #now(): number {
    return (this.#opts.now ?? Date.now)();
  }

  /** Step 1: a raw bus message. Never throws: a bad message is dropped and logged. */
  receive(raw: unknown): void {
    if (this.#disposed) return;
    let value: unknown = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        return this.#invalid();
      }
    }
    const parsed = BusEventSchema.safeParse(value);
    // No zone can be determined: a global envelope failure. Dropped, logged, nothing else is disturbed.
    if (!parsed.success || !isKnownZoneKey(parsed.data.zoneId)) return this.#invalid();
    const event = parsed.data;
    if (event.type !== 'zone.update') return; // a type this canvas does not render is ignored

    // Idempotent updates: a replayed or out-of-order event (when the bus supplies a sequence) is dropped.
    if (event.seq !== undefined) {
      const last = this.#lastSeq.get(event.zoneId);
      if (last !== undefined && event.seq <= last) {
        logEvent('bus.event_dropped', 'info', 'duplicate');
        return;
      }
      this.#lastSeq.set(event.zoneId, event.seq);
    }
    this.receiveZone(event.zoneId, event.payload);
  }

  /** Steps 2 to 4 for one zone's payload. Also used by the refresh manager for a re-delivered context object. */
  receiveZone(key: string, payload: unknown): void {
    if (this.#disposed) return;
    if (this.#opts.isBlocked?.()) {
      this.#queued.push({ key, payload }); // the checkpoint surface and its diff never change underneath the worker
      return;
    }
    const validated = validateZonePayload(payload);
    if (!validated.ok) {
      // A malformed zone payload degrades THAT zone only (BRD 1.0 SR21A).
      logEvent('zone.payload_malformed', 'error', 'malformed');
      this.#clearTimer(key);
      this.#store.markUnavailable(key);
      return;
    }
    this.beginRefresh(key);
    this.#receivedAt.set(key, this.#now());
    this.#pending.set(key, validated.payload); // coalesce: the latest payload for a zone within the window wins
    this.#scheduleFlush();
  }

  /** Step 4: show the indicator immediately and start the staleness clock for this zone. */
  beginRefresh(key: string): void {
    this.#store.beginRefresh(key);
    if (this.#warnTimers.has(key)) return;
    this.#warnTimers.set(
      key,
      startDeadline(
        this.#opts.stalenessWarnMs,
        () => {
          this.#warnTimers.delete(key);
          // Freshness can no longer be guaranteed. The data is kept and the worker is not blocked.
          if (this.#store.get(key).refreshing) {
            this.#store.setRefreshDelayed(key);
            logEvent('zone.refresh_delayed', 'warn');
          }
        },
        this.#opts.now,
      ),
    );
  }

  /** A refresh finished with nothing new to show for this zone. Clears the indicator. */
  endRefresh(key: string): void {
    this.#clearTimer(key);
    this.#store.markFresh(key); // a refresh that changed nothing confirms the data is current
    const s = this.#store.get(key);
    if (s.refreshing) this.#store.markRendered(key, s.version);
  }

  /** The checkpoint ended: apply what was queued while it was active. */
  drainQueue(): void {
    const queued = this.#queued.splice(0);
    for (const { key, payload } of queued) this.receiveZone(key, payload);
  }

  get queuedCount(): number {
    return this.#queued.length;
  }

  dispose(): void {
    this.#disposed = true;
    this.#unsubscribe();
    for (const cancel of this.#warnTimers.values()) cancel();
    this.#warnTimers.clear();
    this.#pending.clear();
    this.#queued = [];
  }

  #scheduleFlush(): void {
    if (this.#flushScheduled) return;
    this.#flushScheduled = true;
    (this.#opts.schedule ?? nextFrame)(() => this.#flush());
  }

  /** Step 5: apply every coalesced zone as one batch. */
  #flush(): void {
    this.#flushScheduled = false;
    if (this.#disposed || this.#pending.size === 0) return;
    const batch = [...this.#pending];
    this.#pending.clear();
    (this.#opts.applyBatch ?? ((f) => f()))(() => {
      for (const [key, payload] of batch) {
        const version = this.#store.apply(key, payload);
        this.#awaiting.set(key, { version, receivedAt: this.#receivedAt.get(key) ?? this.#now() });
      }
    });
  }

  /** Step 6: the zone reports the applied version is rendered. Only now does the indicator clear. */
  #confirm(key: string, version: number): void {
    const waiting = this.#awaiting.get(key);
    if (!waiting || version < waiting.version) return;
    this.#awaiting.delete(key);
    this.#clearTimer(key);
    const ms = this.#now() - waiting.receivedAt;
    this.#opts.onMetric?.({ zoneKey: key, receivedToRenderedMs: ms });
    if (typeof performance !== 'undefined') performance.mark(`zone_render_complete:${key}`);
  }

  #clearTimer(key: string): void {
    this.#warnTimers.get(key)?.();
    this.#warnTimers.delete(key);
  }

  #invalid(): void {
    logEvent('bus.event_invalid', 'error', 'malformed');
  }
}
