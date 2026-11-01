import { z } from 'zod';

// Runtime checks for the delivered shapes in context.ts and history.ts. A payload is `unknown` until one of these has passed it.
// Objects are NOT strict: an extra field is tolerated and left in place, because the canvas never edits what it receives. A field
// that is missing or the wrong type fails.

export const ZoneStateSchema = z.enum(['loading', 'rendered', 'unavailable']);

const EvidenceSchema = z.object({ system: z.string(), ref: z.string() });
export const AlertSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  suggestion: z.string().nullable(),
  evidence: z.array(EvidenceSchema),
});
export const EntitySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  fields: z.array(z.object({ label: z.string(), value: z.string() })),
});
export const StepSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['confirm', 'photo', 'question', 'guide']),
  label: z.string(),
  status: z.enum(['todo', 'current', 'done']),
  required: z.boolean(),
  source: z.string().nullable(),
});
export const ActionSchema = z.object({
  name: z.string().min(1),
  label: z.string(),
  enabled: z.boolean(),
  write_back: z.enum(['auto', 'manual', 'none']),
  needs_checkpoint: z.boolean(),
});
export const HistoryRecordSchema = z.object({
  id: z.string().min(1),
  // Site-local date. Checked for shape only: never parsed into a Date, so the viewer's time zone can never move it.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string(),
  status: z.string(),
  flags: z.array(z.string()),
  sources: z.array(z.string()),
});

const dataZone = <T extends z.ZodType>(data: T) => z.object({ state: ZoneStateSchema, as_of: z.string().nullable(), data });

export const AlertsZoneSchema = dataZone(z.array(AlertSchema));
export const WorkOrderZoneSchema = dataZone(EntitySchema.nullable());
export const StepsZoneSchema = dataZone(z.array(StepSchema));
export const ActionsZoneSchema = dataZone(z.array(ActionSchema));
export const HistoryZoneSchema = z.object({ state: ZoneStateSchema, pointer: z.string().min(1).nullable() });

const timeLocal = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const statusSchema = z.object({ label: z.string().min(1), tone: z.enum(['success', 'warning', 'error', 'checkpoint', 'neutral']) });
const stopSchema = z.object({ id: z.string().min(1), time_local: timeLocal.nullable(), title: z.string().min(1), subtitle: z.string().nullable(), status: statusSchema.nullable() });
const groupSchema = z.object({ heading: z.string().min(1), title: z.string().min(1), caption: z.string().nullable(), items: z.array(stopSchema) });
export const DashboardDataSchema = z.object({
  greeting: z.string().min(1),
  date: z.string().min(1),
  jobs_heading: z.string().min(1),
  counts: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), value: z.union([z.string(), z.number()]), status: z.enum(['warning', 'error']).nullable() })),
  next_job: z
    .object({
      eyebrow: z.string().min(1),
      reference: z.string().min(1),
      time_local: timeLocal.nullable(),
      title: z.string().min(1),
      subtitle: z.string().nullable(),
      location: z.string().nullable(),
      status: statusSchema.nullable(),
      action_label: z.string().min(1),
      note: z.object({ author: z.string().min(1), time_local: timeLocal.nullable(), text: z.string().min(1) }).nullable(),
      // Checked by WidgetContainer, which falls back safely: a bad insight never takes the job card down.
      insight: z.unknown(),
    })
    .nullable(),
  today: groupSchema.nullable(),
  tomorrow: groupSchema.nullable(),
});
export const DashboardZoneSchema = dataZone(DashboardDataSchema.nullable());

/** The zone ids this canvas knows, each with its own schema, so a bad one fails alone. */
const workOrderRowSchema = z.object({ id: z.string().min(1), time_local: timeLocal.nullable(), title: z.string().min(1), status: statusSchema.nullable(), task: z.string().min(1), address: z.string().nullable() });
export const WorkOrdersDataSchema = z.object({
  heading: z.string().min(1),
  groups: z.array(
    z.object({
      id: z.string().min(1),
      heading: z.string().min(1),
      items: z.array(workOrderRowSchema),
      more: z.object({ caption: z.string().min(1), action_label: z.string().min(1) }).nullable(),
    }),
  ),
});
export const WorkOrdersZoneSchema = dataZone(WorkOrdersDataSchema.nullable());

/** Zones the practice API does not deliver yet. Absent is fine and not an error. Present and malformed degrades that zone only. */
export const OPTIONAL_ZONE_SCHEMAS = { dashboard: DashboardZoneSchema, work_orders: WorkOrdersZoneSchema } as const;

export const ZONE_SCHEMAS = {
  alerts: AlertsZoneSchema,
  work_order: WorkOrderZoneSchema,
  steps: StepsZoneSchema,
  actions: ActionsZoneSchema,
  history: HistoryZoneSchema,
} as const;

/** Everything in the envelope EXCEPT the contents of the zones. `zones` itself must be an object, but each zone is checked separately. */
export const EnvelopeSchema = z.object({
  schema_version: z.string().min(1),
  session_id: z.string().min(1),
  delivered_at: z.string().min(1),
  resolved_role: z.string().min(1),
  worker: z.object({ id: z.string().min(1), name: z.string().min(1), role_label: z.string().min(1) }),
  layout_config: z.object({ template_id: z.string().min(1), destinations: z.array(z.string().min(1)) }),
  active_work_order: z.object({ id: z.string().min(1), site_name: z.string(), task_summary: z.string().nullable() }).nullable(),
  connection_status: z.array(
    z.object({ system: z.string().min(1), state: z.enum(['live', 'read_only', 'down']), write_back: z.boolean(), last_synced: z.string().nullable() }),
  ),
  zones: z.record(z.string(), z.unknown()),
  degraded_fields: z.array(z.object({ field: z.string().min(1), reason: z.string() })),
});

export const HistoryMessageSchema = z.object({
  type: z.literal('zone_data'),
  session_id: z.string().min(1),
  zone_id: z.literal('history'),
  seq: z.number().int().nonnegative(),
  state: ZoneStateSchema,
  as_of: z.string().min(1),
  data: z.array(HistoryRecordSchema),
  data_quality: z.object({
    deduplicated: z.number().int().nonnegative(),
    dropped_undated: z.number().int().nonnegative(),
    unavailable_sources: z.array(z.string()),
  }),
});
