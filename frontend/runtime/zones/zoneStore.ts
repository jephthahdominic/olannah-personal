import { ZONE_IDS, isZoneId, validateWireZone, type Wire } from '@/contracts';
import { logEvent } from '../telemetry';

// Render and orchestration state for every zone (BRD 1.0 SR16A): each zone's CONDITION, whether it is refreshing, and
// whether that refresh has outlived the warning threshold. Zones subscribe only to their own key, so an update for one
// zone never re-renders another (SDD 6.5, 13.3).

export type ZoneCondition = 'scaffolded' | 'rendered' | 'empty' | 'unavailable' | 'stale';

export interface ZoneState {
  readonly condition: ZoneCondition;
  /** Shows the refreshing indicator. Refresh and condition are separate dimensions: a stale zone can also refresh. */
  readonly refreshing: boolean;
  /** The refresh outlived the warning threshold: freshness can no longer be guaranteed (not "the data is stale"). */
  readonly refreshDelayed: boolean;
  /** Increments each time an update is applied. The indicator may clear only once this version is on screen. */
  readonly version: number;
  /** How old the zone's data is, as delivered. Shown, never judged: the canvas does not decide what is too old (BRD guide section 3). */
  readonly asOf: string | null;
  /** The delivered data, exactly as received. */
  readonly data?: unknown;
}

const SCAFFOLDED: ZoneState = { condition: 'scaffolded', refreshing: false, refreshDelayed: false, version: 0, asOf: null };

/** A zone nothing has been delivered for yet waits for its data. */
const defaultState = (): ZoneState => SCAFFOLDED;

type Listener = () => void;
export type RenderedListener = (key: string, version: number) => void;

export class ZoneStore {
  #zones = new Map<string, ZoneState>();
  #listeners = new Map<string, Set<Listener>>();
  #rendered = new Set<RenderedListener>();

  /** Resets every zone, then ingests the zones of the validated context object. A malformed one is unavailable, and only that one. */
  initialize(zones: Wire.ValidatedZones): void {
    this.#zones.clear();
    const entries: [string, Wire.ZoneOutcome<Wire.WireZone> | undefined][] = [...ZONE_IDS.map((key) => [key, zones[key]] as [string, Wire.ZoneOutcome<Wire.WireZone>]), ['dashboard', zones.dashboard], ['work_orders', zones.work_orders]];
    for (const [key, outcome] of entries) {
      // The dashboard and work orders zones are optional: absent means there is none, not that it failed.
      if (!outcome) continue;
      if (outcome.ok) this.set(key, stateFromZone(key, outcome.zone));
      else {
        logEvent('zone.payload_malformed', 'error', 'malformed');
        this.set(key, { ...SCAFFOLDED, condition: 'unavailable' });
      }
    }
  }

  keys(): string[] {
    return [...this.#zones.keys()];
  }

  get = (key: string): ZoneState => this.#zones.get(key) ?? defaultState();

  subscribe = (key: string) => (listener: Listener): (() => void) => {
    let set = this.#listeners.get(key);
    if (!set) this.#listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  };

  /** Told when a zone confirms an applied version is on screen. The update pipeline uses this to clear its timers. */
  onRendered(listener: RenderedListener): () => void {
    this.#rendered.add(listener);
    return () => this.#rendered.delete(listener);
  }

  set(key: string, next: ZoneState): void {
    const prev = this.#zones.get(key);
    if (prev && sameState(prev, next)) return;
    this.#zones.set(key, next);
    this.#notify(key);
  }

  /** Shows the refreshing indicator immediately (BRD 1.0 UR7A). */
  beginRefresh(key: string): void {
    const s = this.get(key);
    if (s.condition === 'scaffolded' || s.refreshing) return;
    this.set(key, { ...s, refreshing: true });
  }

  /** The refresh outlived the warning threshold. The data is kept; the worker is not blocked (BRD 1.0 error row 11). */
  setRefreshDelayed(key: string): void {
    const s = this.get(key);
    if (!s.refreshing || s.refreshDelayed) return;
    this.set(key, { ...s, refreshDelayed: true });
  }

  /** Applies a validated update. The indicator is NOT cleared here: only render confirmation clears it. */
  apply(key: string, zone: Wire.WireZone): number {
    const prev = this.get(key);
    const version = prev.version + 1;
    // Keep the refresh indicator exactly as it was: only render confirmation (markRendered) may clear it.
    const next = { ...stateFromZone(key, zone), version, refreshing: prev.refreshing, refreshDelayed: prev.refreshDelayed };
    this.set(key, next);
    return version;
  }

  /** The zone confirms `version` is rendered. Only now may the refreshing indicator clear (BRD 1.0 UR7C, UR8B). */
  markRendered(key: string, version: number): void {
    const s = this.get(key);
    if (s.version !== version) return; // a newer update arrived; wait for its render
    if (s.refreshing) this.set(key, { ...s, refreshing: false, refreshDelayed: false });
    for (const l of [...this.#rendered]) l(key, version);
  }

  /** A zone's own render failed (caught by its boundary). Only this zone changes. */
  markUnavailable(key: string): void {
    const s = this.get(key);
    this.set(key, { ...s, condition: 'unavailable', refreshing: false, refreshDelayed: false });
  }

  /** Connection lost: zones that show data keep it, marked stale. Empty, unavailable and waiting zones are unchanged. */
  markAllStale(): void {
    for (const [key, s] of this.#zones) if (s.condition === 'rendered') this.set(key, { ...s, condition: 'stale' });
  }

  /** A refresh confirmed the data is current: a stale zone is rendered again. */
  markFresh(key: string): void {
    const s = this.get(key);
    if (s.condition === 'stale') this.set(key, { ...s, condition: 'rendered' });
  }

  clear(): void {
    this.#zones.clear();
    for (const set of this.#listeners.values()) for (const l of [...set]) l();
  }

  #notify(key: string): void {
    for (const l of [...(this.#listeners.get(key) ?? [])]) l();
  }
}

function sameState(a: ZoneState, b: ZoneState): boolean {
  return (
    a.condition === b.condition &&
    a.refreshing === b.refreshing &&
    a.refreshDelayed === b.refreshDelayed &&
    a.version === b.version &&
    a.asOf === b.asOf &&
    a.data === b.data
  );
}

const isEmptyData = (data: unknown): boolean => data === null || data === undefined || (Array.isArray(data) && data.length === 0);

/**
 * What a delivered zone looks like on screen (BRD SR16A). The zone's state says whether its data is loading, rendered or unavailable.
 * A rendered zone with nothing in it is an EMPTY state, not an error. The data is kept exactly as delivered.
 */
export function stateFromZone(key: string, zone: Wire.WireZone): ZoneState {
  const base = { refreshing: false, refreshDelayed: false, version: 0 };
  if (zone.state === 'unavailable') {
    logEvent('zone.unavailable', 'warn', 'unavailable');
    return { ...base, condition: 'unavailable', asOf: 'as_of' in zone ? zone.as_of : null };
  }
  // History is delivered in a second pass and owns its own loading state (BRD UR9A). The zone only says whether there is a job to
  // load history for: no pointer means no active job, which is an empty state.
  if (key === 'history') {
    const { pointer } = zone as Wire.HistoryZone;
    return { ...base, condition: pointer === null ? 'empty' : 'rendered', asOf: null };
  }
  const data = zone as Wire.DataZone<unknown>;
  if (zone.state === 'loading') return { ...base, condition: 'scaffolded', asOf: data.as_of };
  return isEmptyData(data.data)
    ? { ...base, condition: 'empty', asOf: data.as_of }
    : { ...base, condition: 'rendered', asOf: data.as_of, data: data.data };
}

/** Validates ONE zone that arrived after the context. A bad one degrades that zone only (BRD SR21A, error row 7). */
export function validateZoneUpdate(key: string, raw: unknown): { ok: true; zone: Wire.WireZone } | { ok: false } {
  if (!isZoneId(key)) return { ok: false };
  return validateWireZone(key, raw);
}
