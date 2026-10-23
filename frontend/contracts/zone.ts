import { z } from 'zod';

// DRAFT. Zone-scoped payloads inside the context object (BRD 1.0 SR21A). A malformed one degrades THAT zone only.
// Status is SUPPLIED upstream. The canvas never infers degradation from missing fields (BRD 1.2 5.11 Feature 5).
export const ZonePayloadSchema = z
  .object({
    status: z.enum(['ready', 'empty', 'degraded', 'unavailable']),
    // Plain-language text for degraded and unavailable zones, supplied. Never generated from a code.
    message: z.string().min(1).optional(),
    data: z.unknown().optional(),
  })
  .refine((v) => v.status !== 'degraded' || v.message !== undefined, {
    message: 'a degraded zone must supply its message',
  });
export type ZonePayload = z.infer<typeof ZonePayloadSchema>;
