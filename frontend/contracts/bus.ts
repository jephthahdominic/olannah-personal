import { z } from 'zod';

// DRAFT. Event format, subscription API, ordering and heartbeat are OPEN (BRD 1.0 OQ4, SDD K3).
export const BusEventSchema = z.object({
  type: z.string().min(1),
  zoneId: z.string().min(1),
  // Requested from Integrations and Connectors so out-of-order and replayed events can be dropped (SDD 7.5).
  seq: z.number().int().nonnegative().optional(),
  payload: z.unknown(),
});
export type BusEvent = z.infer<typeof BusEventSchema>;
