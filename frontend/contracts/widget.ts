import { z } from 'zod';

// DRAFT. The shared, versioned widget contract between the AI insight layer and the canvas (BRD 1.2 5.11). It is OPEN and
// must be agreed with Intelligence (BRD 1.2 OQ3, SDD K5/Q6). Until then this file is the canvas's own draft, and EVERYTHING
// outside it falls back safely. Neither side may introduce a production widget type or version independently of it.

/** What an insight layer delivers. The container validates the type and version first, then the structure of `payload`. */
export const WidgetEnvelopeSchema = z.object({
  type: z.string().min(1),
  schemaVersion: z.string().min(1),
  payload: z.unknown(),
  // Supplied when the insight was built from incomplete or stale inputs. The container never infers it (1.2 5.11 Feature 5).
  condition: z.literal('degraded').optional(),
  degradedMessage: z.string().min(1).optional(),
});
export type WidgetEnvelope = z.infer<typeof WidgetEnvelopeSchema>;

/** The supported widget types and their versions. Anything else is "unsupported", never a best-guess render. */
export const SUPPORTED_WIDGETS = { insight: ['1.0'] } as const;
export type WidgetType = keyof typeof SUPPORTED_WIDGETS;

export function isSupportedWidget(type: string, version: string): type is WidgetType {
  const versions = (SUPPORTED_WIDGETS as Record<string, readonly string[]>)[type];
  return !!versions && versions.includes(version);
}

// Widgets are DISPLAY-ONLY at P0: no action control, no write, no workflow mutation (BRD 1.2 Assumption 12). A future action
// routes through the Human Checkpoint Protocol and is out of scope until specified.
export const InsightPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  /** Supplied evidence text, for example "Service history: Aug 12 sensor reset". */
  evidence: z.string().optional(),
  /** Supplied label, for example "Evidence-backed". */
  label: z.string().optional(),
});
export type InsightPayload = z.infer<typeof InsightPayloadSchema>;

export const WIDGET_PAYLOAD_SCHEMAS = { insight: InsightPayloadSchema } as const;
