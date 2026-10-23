import { ZoneDataSchema, ZonePayloadSchema, type ZonePayload } from '@/contracts';
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
  /** Supplied plain-language message for degraded or unavailable zones. */
  readonly message?: string;
  /** True when upstream supplied the zone as degraded (partially available). Rendered with a warning banner. */
  readonly degraded: boolean;
  readonly data?: unknown;
}

const SCAFFOLDED: ZoneState = { condition: 'scaffolded', refreshing: false, refreshDelayed: false, version: 0, degraded: false };
const EMPTY: ZoneState = { condition: 'empty', refreshing: false, refreshDelayed: false, version: 0, degraded: false };

/** A zone with no delivered payload: the dashboard and context wait for data; other destinations have none to show. */
function defaultState(key: string): ZoneState {
  return key.startsWith('primary:') && key !== 'primary:dashboard' ? EMPTY : SCAFFOLDED;
}

export type PayloadValidation = { ok: true; payload: ZonePayload } | { ok: false };

/** Validates a zone payload AND its data shape. A bad one degrades that zone only (BRD 1.0 SR21A, error row 7). */
export function validateZonePayload(raw: unknown): PayloadValidation {
  const parsed = ZonePayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  if (parsed.data.data !== undefined && !ZoneDataSchema.safeParse(parsed.data.data).success) return { ok: false };
  return { ok: true, payload: parsed.data };
}

type Listener = () => void;
export type RenderedListener = (key: string, version: number) => void;

export class ZoneStore {
  #zones = new Map<string, ZoneState>();
  #listeners = new Map<string, Set<Listener>>();
  #rendered = new Set<RenderedListener>();

  /** Resets every zone, then ingests the zone-scoped payloads from the context object. */
  initialize(zoneIds: readonly string[], rawZones: Readonly<Record<string, unknown>>): void {
    this.#zones.clear();
    const keys = new Set([...zoneIds, ...Object.keys(rawZones)]);
    for (const key of keys) this.set(key, this.#fromRaw(key, rawZones[key]));
  }

  keys(): string[] {
    return [...this.#zones.keys()];
  }

  get = (key: string): ZoneState => this.#zones.get(key) ?? defaultState(key);

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
  apply(key: string, payload: ZonePayload): number {
    const prev = this.get(key);
    const version = prev.version + 1;
    // Keep the refresh indicator exactly as it was: only render confirmation (markRendered) may clear it.
    const next = { ...stateFromPayload(key, payload), version, refreshing: prev.refreshing, refreshDelayed: prev.refreshDelayed };
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
  markUnavailable(key: string, message?: string): void {
    const s = this.get(key);
    this.set(key, { ...s, condition: 'unavailable', refreshing: false, refreshDelayed: false, degraded: false, ...(message ? { message } : {}) });
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

  #fromRaw(key: string, raw: unknown): ZoneState {
    // Absent payload: the zone is still waiting for its data (loading skeleton). It is not an error.
    if (raw === undefined) return defaultState(key);
    const validated = validateZonePayload(raw);
    if (!validated.ok) {
      logEvent('zone.payload_malformed', 'error', 'malformed');
      return { ...SCAFFOLDED, condition: 'unavailable' };
    }
    return stateFromPayload(key, validated.payload);
  }
}

function sameState(a: ZoneState, b: ZoneState): boolean {
  return (
    a.condition === b.condition &&
    a.refreshing === b.refreshing &&
    a.refreshDelayed === b.refreshDelayed &&
    a.version === b.version &&
    a.message === b.message &&
    a.degraded === b.degraded &&
    a.data === b.data
  );
}

export function stateFromPayload(_key: string, payload: ZonePayload): ZoneState {
  const base = { refreshing: false, refreshDelayed: false, version: 0 };
  switch (payload.status) {
    case 'ready':
      return { ...base, condition: 'rendered', degraded: false, data: payload.data };
    case 'degraded':
      return { ...base, condition: 'rendered', degraded: true, message: payload.message, data: payload.data };
    case 'empty':
      return { ...base, condition: 'empty', degraded: false };
    case 'unavailable':
      logEvent('zone.unavailable', 'warn', 'unavailable');
      return { ...base, condition: 'unavailable', degraded: false, ...(payload.message ? { message: payload.message } : {}) };
  }
}
