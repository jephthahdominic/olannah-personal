import { z } from 'zod';

// DRAFT. History is delivered by the Streaming Canvas Aggregator in a SUBSEQUENT pass, outside the 1,500ms assembly
// window (BRD 1.0 UR9, PT8). The contract is OPEN (1.0 OQ5). Dates are site-local "YYYY-MM-DD", never converted.
export const HistoryRecordSchema = z.object({
  id: z.string().min(1),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  summary: z.string().optional(),
});
export type HistoryRecord = z.infer<typeof HistoryRecordSchema>;

export const HistoryPayloadSchema = z.object({
  records: z.array(HistoryRecordSchema),
  // Opaque cursor for the next page, or null when there is no more. The canvas relays it, never interprets it.
  nextCursor: z.string().nullable(),
  // Supplied when the history is partial (stale or limited). Never inferred from the data.
  degradedMessage: z.string().optional(),
});
export type HistoryPayload = z.infer<typeof HistoryPayloadSchema>;
