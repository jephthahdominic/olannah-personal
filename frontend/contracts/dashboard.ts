import { z } from 'zod';

// DRAFT. Zone DATA shapes carried inside a zone payload (BRD 1.0 SR21A). Every displayed value is SUPPLIED: counts,
// captions, headlines, status labels. The canvas never computes a greeting, a count or a status (BRD 1.2 5.2 Feature 7).
// Times are site-local wall-clock "HH:MM"; the canvas formats them and never converts time zones (BRD 1.2 5.3 Feature 2).

const tone = z.enum(['default', 'attention', 'success']);
const pillTone = z.enum(['success', 'warning', 'error', 'checkpoint', 'neutral']);
const siteLocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'site-local time must be HH:MM');

const status = z.object({ label: z.string().min(1), tone: pillTone });

export const DashboardDataSchema = z.object({
  kind: z.literal('dashboard'),
  headline: z.string().min(1),
  summaryTitle: z.string().min(1),
  summary: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), value: z.union([z.string(), z.number()]), caption: z.string().optional(), tone: tone.default('default') })),
  // A single highlighted item (the technician's next job). null/absent means there is none to show.
  featured: z
    .object({
      eyebrow: z.string().min(1),
      reference: z.string().min(1),
      timeLocal: siteLocalTime.optional(),
      title: z.string().min(1),
      subtitle: z.string().optional(),
      location: z.string().optional(),
      status: status.optional(),
      note: z.object({ author: z.string().min(1), text: z.string().min(1) }).optional(),
      actionLabel: z.string().min(1),
    })
    .nullable()
    .optional(),
  queueTitle: z.string().min(1),
  queueCaption: z.string().optional(),
  queue: z.array(z.object({ id: z.string().min(1), timeLocal: siteLocalTime.optional(), title: z.string().min(1), subtitle: z.string().optional(), trailing: z.string().optional(), status: status.optional() })),
  // A pushed update the worker should notice (for example a store-manager note). Supplied text.
  notice: z.object({ title: z.string().min(1), body: z.string().min(1), tone: z.enum(['info', 'success']) }).optional(),
});
export type DashboardData = z.infer<typeof DashboardDataSchema>;

export const ContextPanelDataSchema = z.object({
  kind: z.literal('context'),
  title: z.string().min(1),
  status: z.object({ label: z.string().min(1), tone: pillTone }).optional(),
  lines: z.array(z.string().min(1)),
  source: z.string().optional(),
  // The history POINTER is not here: it lives in the context object and is never used by the canvas (BRD 1.0 Assumption 4).
  historyTitle: z.string().min(1),
});
export type ContextPanelData = z.infer<typeof ContextPanelDataSchema>;

/** Every zone data shape the canvas can render. An unknown kind is treated as a malformed zone payload. */
export const ZoneDataSchema = z.discriminatedUnion('kind', [DashboardDataSchema, ContextPanelDataSchema]);
export type ZoneData = z.infer<typeof ZoneDataSchema>;
