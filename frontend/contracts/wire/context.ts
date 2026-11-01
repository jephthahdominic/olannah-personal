// The context object exactly as the PCR delivers it (Canvas Shell BRD V3 section 9; backend/context_api/handoff). Field names are
// the wire names, snake_case included, because the canvas never renames, reshapes or edits what it receives (BRD SR16C).
// Everything is readonly: the validated object is deep-frozen, so these types say so.
//
// These are TYPES ONLY. They describe a payload that has passed validation. Nothing here validates: a raw payload is `unknown`
// until the zod schemas in a later step have checked it, so a malformed one can never be typed as one of these.

/** Versions this canvas can read. An unlisted one is a schema mismatch: recovery screen, never a guess (BRD SR20). */
export type WireContextVersion = '1.0';

/**
 * What the PCR can say about a zone (BRD SR16A). There is deliberately no `stale`: a refresh that has not resolved is the canvas's
 * own state. A received `stale` makes that zone's payload malformed.
 */
export type ZoneState = 'loading' | 'rendered' | 'unavailable';

/**
 * The zone ids of the technician context: five the practice API delivers, and `dashboard`, which is a PROPOSED sixth (see
 * PROPOSED_DASHBOARD_ZONE.md) that is optional until the backend supplies it. The zone model proper is owned by BRD 1.2, so unknown ids
 * must be tolerated.
 */
export type ZoneId = 'alerts' | 'work_order' | 'steps' | 'actions' | 'history' | 'dashboard' | 'work_orders';

// ---------- view models inside the zones ----------
export interface Evidence {
  readonly system: string;
  readonly ref: string;
}

export interface Alert {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
  readonly suggestion: string | null;
  readonly evidence: readonly Evidence[];
}

export interface EntityField {
  readonly label: string;
  readonly value: string;
}

/** The work order as a titled list of label/value pairs. Shown as given, never interpreted. */
export interface Entity {
  readonly id: string;
  readonly title: string;
  readonly fields: readonly EntityField[];
}

export interface Step {
  readonly id: string;
  readonly kind: 'confirm' | 'photo' | 'question' | 'guide';
  readonly label: string;
  readonly status: 'todo' | 'current' | 'done';
  readonly required: boolean;
  readonly source: string | null;
}

export interface Action {
  readonly name: string;
  readonly label: string;
  /** Resolved upstream. Rendered as given. The canvas adds no permission logic of its own (BRD SR23C). */
  readonly enabled: boolean;
  readonly write_back: 'auto' | 'manual' | 'none';
  /** Information only. The canvas never decides when an approval screen appears (BRD Non-Goal 3). */
  readonly needs_checkpoint: boolean;
}

export interface HistoryRecord {
  readonly id: string;
  /** Site-local date, YYYY-MM-DD. Never converted to the viewer's time zone. */
  readonly date: string;
  readonly title: string;
  readonly status: string;
  readonly flags: readonly string[];
  readonly sources: readonly string[];
}

// ---------- zones ----------
/** A zone that carries data. `as_of` says how old the data is: shown, never judged. */
export interface DataZone<TData> {
  readonly state: ZoneState;
  readonly as_of: string | null;
  /** Empty when `state` is `unavailable`. An empty `rendered` zone is an empty state, never an error. */
  readonly data: TData;
}

export type AlertsZone = DataZone<readonly Alert[]>;
export type WorkOrderZone = DataZone<Entity | null>;
export type StepsZone = DataZone<readonly Step[]>;
export type ActionsZone = DataZone<readonly Action[]>;

/** History arrives in a second delivery. The context only says it is coming, and gives an opaque pointer. */
export interface HistoryZone {
  readonly state: ZoneState;
  /** Opaque. Never built or edited by the canvas. Null when the worker has no active job, so there is nothing to load. */
  readonly pointer: string | null;
}

// ---------- the proposed dashboard zone (approved design 03 Dashboard) ----------
// Every word and figure on the Dashboard is SUPPLIED: the greeting, the date, the counts, the headings and the button label. The canvas
// never computes a greeting, a count or a status (BRD 1.2 5.2 Feature 7). Times are site-local wall-clock "HH:MM", formatted and never
// converted. Nothing here names a source system.
export type DashboardTone = 'success' | 'warning' | 'error' | 'checkpoint' | 'neutral';
export interface DashboardStatus {
  readonly label: string;
  readonly tone: DashboardTone;
}
export interface DashboardCount {
  readonly id: string;
  readonly label: string;
  /** Shown exactly as supplied. An unknown count is supplied as an em dash, never worked out. */
  readonly value: string | number;
  /** The shape beside the figure, supplied: a warning triangle or an error circle. Null shows none, including for a zero. */
  readonly status: 'warning' | 'error' | null;
}
export interface DashboardNote {
  /** Who wrote it, for example "Store manager". */
  readonly author: string;
  readonly time_local: string | null;
  readonly text: string;
}
export interface DashboardStop {
  readonly id: string;
  readonly time_local: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: DashboardStatus | null;
}
export interface DashboardGroup {
  /** The section heading above the list, for example "Today". */
  readonly heading: string;
  /** The list's own title, for example "Later today". */
  readonly title: string;
  /** For example "2 stops". Supplied, never counted. */
  readonly caption: string | null;
  readonly items: readonly DashboardStop[];
}
export interface DashboardNextJob {
  /** For example "Next job". */
  readonly eyebrow: string;
  readonly reference: string;
  readonly time_local: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly location: string | null;
  readonly status: DashboardStatus | null;
  /** The outcome-named label of the button that opens the job, for example "Open work order". */
  readonly action_label: string;
  /** A client note that arrived about this job. */
  readonly note: DashboardNote | null;
  /** An insight widget envelope, validated by WidgetContainer. Absent for a job with no supplied insight. */
  readonly insight: unknown;
}
export interface DashboardData {
  readonly greeting: string;
  readonly date: string;
  /** The heading shown above the counts while the zone refreshes or may be out of date, for example "Your jobs". */
  readonly jobs_heading: string;
  readonly counts: readonly DashboardCount[];
  /** Null when there is no job. */
  readonly next_job: DashboardNextJob | null;
  readonly today: DashboardGroup | null;
  readonly tomorrow: DashboardGroup | null;
}
export type DashboardZone = DataZone<DashboardData | null>;

/** The zones every delivery carries. */
export type RequiredZoneId = Exclude<ZoneId, OptionalZoneId>;
/** The proposed zones the practice API does not deliver yet. */
export type OptionalZoneId = 'dashboard' | 'work_orders';

// ---------- the proposed work orders zone (approved design 04 Work Orders) ----------
// The worker's assigned jobs, grouped. Every word is SUPPLIED, including the page heading, the group headings and the "Showing 4 of 11" line.
// Rows are in the order sent and are never sorted or filtered. Times are site-local "HH:MM". Nothing here names a source system.
export interface WorkOrderRow {
  /** The work order reference, for example "WO-48213". Also what a selection reports, and what the canvas matches against the active job. */
  readonly id: string;
  readonly time_local: string | null;
  /** The client, for example "Northgate Grocers #4830". */
  readonly title: string;
  readonly status: DashboardStatus | null;
  /** The task, for example "Walk-in freezer not recovering temperature". */
  readonly task: string;
  readonly address: string | null;
}
export interface WorkOrdersMore {
  /** For example "Showing 4 of 11 jobs". Supplied, never counted. */
  readonly caption: string;
  /** For example "Show 7 more jobs". */
  readonly action_label: string;
}
export interface WorkOrdersGroup {
  readonly id: string;
  /** For example "Today". */
  readonly heading: string;
  readonly items: readonly WorkOrderRow[];
  /** Present when more rows can be asked for. The canvas asks through a request-more event and the backend supplies them. */
  readonly more: WorkOrdersMore | null;
}
export interface WorkOrdersData {
  /** The page heading, for example "Work orders". */
  readonly heading: string;
  /** Empty when no job is assigned for today or tomorrow. */
  readonly groups: readonly WorkOrdersGroup[];
}
export type WorkOrdersZone = DataZone<WorkOrdersData | null>;

export interface Zones {
  readonly alerts: AlertsZone;
  readonly work_order: WorkOrderZone;
  readonly steps: StepsZone;
  readonly actions: ActionsZone;
  readonly history: HistoryZone;
  /** Optional. Absent from the practice API today. */
  readonly dashboard?: DashboardZone;
  /** Optional. Absent from the practice API today. */
  readonly work_orders?: WorkOrdersZone;
}

// ---------- the envelope ----------
export interface Worker {
  readonly id: string;
  readonly name: string;
  /** Display name of the role, for the Context Header. Not the role id. */
  readonly role_label: string;
}

export interface LayoutConfig {
  /** Picks the layout template. */
  readonly template_id: string;
  /** Ordered, role-determined destination ids. Universal destinations (Dashboard, More, Settings) are never in this list (BRD SR24). */
  readonly destinations: readonly string[];
}

export interface ActiveWorkOrder {
  readonly id: string;
  readonly site_name: string;
  readonly task_summary: string | null;
}

export interface SystemStatus {
  readonly system: string;
  readonly state: 'live' | 'read_only' | 'down';
  /** False means actions against this system are manual steps. */
  readonly write_back: boolean;
  readonly last_synced: string | null;
}

/**
 * A flag the PCR raises about the delivery. The canvas READS these and never infers them from missing data (BRD UR3C).
 *  - field `layout`, reason `unmapped_role`: load the platform default layout.
 *  - field `source.<system>`: that system is down.
 *  - field `delivery`, reason `budget_exceeded`: the context arrived after 800 ms but did arrive.
 */
export interface DegradedField {
  readonly field: string;
  readonly reason: string;
}

export interface ContextObject {
  readonly schema_version: WireContextVersion;
  readonly session_id: string;
  readonly delivered_at: string;
  /** The primary role id. Where this finally lives (session or context) is BRD open question 1. */
  readonly resolved_role: string;
  readonly worker: Worker;
  readonly layout_config: LayoutConfig;
  /** Non-null: show the Context Header. Null: hide it. The header's visibility comes from this field alone (BRD SR26E). */
  readonly active_work_order: ActiveWorkOrder | null;
  readonly connection_status: readonly SystemStatus[];
  readonly zones: Zones;
  readonly degraded_fields: readonly DegradedField[];
}
