import { z } from 'zod';

// DRAFT. Format is OPEN (BRD 1.0 OQ2). Mirrors BRD 1.0 Assumption 1 and SDD Appendix C.
// resolvedRole is the worker's PRIMARY role; null when it cannot be determined (BRD 1.0 OQ1: role may live
// only in the context object instead, so the canvas treats the context object's role as authoritative).
export const SessionConfirmationSchema = z.object({
  userId: z.string().min(1),
  resolvedRole: z.string().min(1).nullable(),
  tenantId: z.string().min(1),
  // Memory only. Never logged, never placed in URLs or storage.
  sessionToken: z.string().min(1),
  // OPEN (SDD Q2): non-secret identifier, would let the shell tell a reload from a fresh login.
  sessionId: z.string().min(1).optional(),
});
export type SessionConfirmation = z.infer<typeof SessionConfirmationSchema>;
