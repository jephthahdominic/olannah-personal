import { isSupportedContextVersion } from '../version';
import { EnvelopeSchema, HistoryMessageSchema, OPTIONAL_ZONE_SCHEMAS, ZONE_SCHEMAS } from './schemas';
import type { ActionsZone, AlertsZone, ContextObject, DashboardZone, HistoryZone, RequiredZoneId, StepsZone, WorkOrderZone, WorkOrdersZone, ZoneId } from './context';
import type { HistoryMessage } from './history';

// The boundary between what arrives and what the canvas will render (BRD SR20, SR21). Nothing here throws, and nothing here edits
// the payload: a bad one becomes a typed failure value.

/** One zone, checked on its own. A malformed zone degrades THAT zone only (BRD SR21A, error row 7). */
export type ZoneOutcome<Z> = { readonly ok: true; readonly zone: Z } | { readonly ok: false };

export interface ValidatedZones {
  readonly alerts: ZoneOutcome<AlertsZone>;
  readonly work_order: ZoneOutcome<WorkOrderZone>;
  readonly steps: ZoneOutcome<StepsZone>;
  readonly actions: ZoneOutcome<ActionsZone>;
  readonly history: ZoneOutcome<HistoryZone>;
  /** Only present when the delivery included a dashboard zone. */
  readonly dashboard?: ZoneOutcome<DashboardZone>;
  /** Only present when the delivery included a work orders zone. */
  readonly work_orders?: ZoneOutcome<WorkOrdersZone>;
}

/** The context object with its zones individually checked. Everything else is as delivered. */
export type ValidatedContext = Omit<ContextObject, 'zones'> & { readonly zones: ValidatedZones };

export type WireContextValidation =
  | {
      readonly kind: 'ok';
      readonly context: ValidatedContext;
      /** Zones that failed their own check, so the runtime can emit one structured error event for each. */
      readonly malformedZones: readonly ZoneId[];
    }
  /** Unrecognized version: recovery screen plus a version-mismatch event (BRD SR20, error row 4). */
  | { readonly kind: 'schema_mismatch'; readonly version: string }
  /** The envelope itself is malformed, so the affected zone cannot be determined: whole-workspace fallback (BRD SR21B, row 5). */
  | { readonly kind: 'envelope_malformed' };

/** The zone ids every delivery must carry. */
export const ZONE_IDS = Object.keys(ZONE_SCHEMAS) as RequiredZoneId[];
/** Zones that may be absent. */
export const OPTIONAL_ZONE_IDS = Object.keys(OPTIONAL_ZONE_SCHEMAS) as ZoneId[];
export const isZoneId = (value: string): value is ZoneId => (ZONE_IDS as readonly string[]).includes(value) || (OPTIONAL_ZONE_IDS as readonly string[]).includes(value);

/** Any one delivered zone. */
export type WireZone = AlertsZone | WorkOrderZone | StepsZone | ActionsZone | HistoryZone | DashboardZone | WorkOrdersZone;

/**
 * Checks ONE zone on its own, for an update that arrives after the context (a bus event or a refresh). A bad one degrades that zone
 * only (BRD SR21A). The zone as delivered is returned, never a parsed copy.
 */
export function validateWireZone(id: ZoneId, raw: unknown): ZoneOutcome<WireZone> {
  const schema = id in OPTIONAL_ZONE_SCHEMAS ? OPTIONAL_ZONE_SCHEMAS[id as keyof typeof OPTIONAL_ZONE_SCHEMAS] : ZONE_SCHEMAS[id as keyof typeof ZONE_SCHEMAS];
  return schema.safeParse(raw).success ? { ok: true, zone: raw as WireZone } : { ok: false };
}

export function validateWireContext(raw: unknown): WireContextValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { kind: 'envelope_malformed' };
  const version = (raw as { schema_version?: unknown }).schema_version;
  if (typeof version !== 'string' || version.length === 0) return { kind: 'envelope_malformed' };
  // The version is checked before the rest: a newer producer may have changed any other field.
  if (!isSupportedContextVersion(version)) return { kind: 'schema_mismatch', version };

  const envelope = EnvelopeSchema.safeParse(raw);
  if (!envelope.success) return { kind: 'envelope_malformed' };

  const rawZones = envelope.data.zones;
  const malformedZones: ZoneId[] = [];
  const outcomes = {} as Record<ZoneId, ZoneOutcome<unknown>>;
  for (const id of ZONE_IDS) {
    // A missing zone cannot be assumed empty or unavailable: it is malformed.
    const checked = ZONE_SCHEMAS[id].safeParse(rawZones[id]);
    if (checked.success) {
      outcomes[id] = { ok: true, zone: rawZones[id] };
    } else {
      outcomes[id] = { ok: false };
      malformedZones.push(id);
    }
  }
  // Optional zones: absent is fine, present-and-malformed degrades that zone only.
  for (const id of OPTIONAL_ZONE_IDS) {
    if (rawZones[id] === undefined) continue;
    const checked = OPTIONAL_ZONE_SCHEMAS[id as keyof typeof OPTIONAL_ZONE_SCHEMAS].safeParse(rawZones[id]);
    if (checked.success) outcomes[id] = { ok: true, zone: rawZones[id] };
    else {
      outcomes[id] = { ok: false };
      malformedZones.push(id);
    }
  }
  // The envelope fields are returned as delivered (the original object), never the parsed copy, so nothing is stripped or coerced.
  const context = { ...(raw as object), zones: outcomes } as unknown as ValidatedContext;
  return { kind: 'ok', context, malformedZones };
}

export type WireHistoryValidation =
  | { readonly kind: 'ok'; readonly message: HistoryMessage }
  /** The history payload is malformed: the history zone shows its unavailable state. Nothing else is affected. */
  | { readonly kind: 'malformed' };

export function validateWireHistory(raw: unknown): WireHistoryValidation {
  const checked = HistoryMessageSchema.safeParse(raw);
  return checked.success ? { kind: 'ok', message: raw as HistoryMessage } : { kind: 'malformed' };
}
