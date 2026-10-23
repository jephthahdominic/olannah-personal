import { z } from 'zod';
import { isSupportedContextVersion } from './version';

// DRAFT. Transport and exact shape are OPEN (SDD K2, Q3). Mirrors BRD 1.0 section 9 "Context object".

export const LayoutConfigSchema = z.object({
  // Identifies which layout template to load. 'default' is the platform default delivered by the PCR.
  layoutId: z.string().min(1),
  // Ordered, role-determined destination identifiers only. Universal destinations are never in this list.
  destinations: z.array(z.string().min(1)),
  refreshTriggers: z.array(z.string()),
});
export type LayoutConfig = z.infer<typeof LayoutConfigSchema>;

export const ToolStatusSchema = z.object({
  toolId: z.string().min(1),
  status: z.enum(['connected', 'degraded', 'unavailable']),
});

// Who the worker is, as the topbar and greetings show it (Figma: "MB", "Marcus Bell", "Senior estimator").
// Supplied by the PCR. The canvas never derives initials or titles itself.
export const WorkerIdentitySchema = z.object({
  displayName: z.string().min(1),
  initials: z.string().min(1).max(3),
  jobTitle: z.string().min(1),
});
export type WorkerIdentity = z.infer<typeof WorkerIdentitySchema>;

export const ContextEnvelopeSchema = z.object({
  schemaVersion: z.string().min(1),
  worker: WorkerIdentitySchema,
  // null means the role could not be determined at all (distinct from an unmapped role).
  resolvedRole: z.string().min(1).nullable(),
  persona: z.record(z.string(), z.unknown()),
  toolConnections: z.array(ToolStatusSchema),
  // The canvas never uses this pointer. The Streaming Canvas Aggregator resolves it (BRD 1.0 Assumption 4).
  historyRef: z.string(),
  layoutConfig: LayoutConfigSchema,
  // Consumers read this list, not the absence of data (BRD 1.1 Assumption 5).
  degradedFields: z.array(z.string()),
  // Zone-scoped payloads, validated per zone by the zone store.
  zones: z.record(z.string(), z.unknown()),
  // Tenant configuration may supply a label per destination (BRD 1.0 "Destination catalog"). Identifiers never change.
  tenantLabels: z.record(z.string(), z.string()).optional(),
  // Destinations that cannot currently be reached (for example offline-incapable ones). Supplied, never derived.
  unavailableDestinations: z.array(z.string()).optional(),
});
export type ContextEnvelope = z.infer<typeof ContextEnvelopeSchema>;

export type ContextValidation =
  | { kind: 'ok'; context: ContextEnvelope }
  // Unrecognized version: recovery screen + version-mismatch event (BRD 1.0 SR20, error row 4).
  | { kind: 'schema_mismatch'; version: string | null }
  // Global envelope malformed and the affected zone cannot be determined (BRD 1.0 SR21B, error row 5).
  | { kind: 'envelope_malformed' };

/** Validates a raw payload at the boundary. Never throws: a bad payload becomes a typed failure value. */
export function validateContext(raw: unknown): ContextValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { kind: 'envelope_malformed' };
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'string' || version.length === 0) {
    return { kind: 'envelope_malformed' };
  }
  if (!isSupportedContextVersion(version)) {
    return { kind: 'schema_mismatch', version };
  }
  const parsed = ContextEnvelopeSchema.safeParse(raw);
  return parsed.success ? { kind: 'ok', context: parsed.data } : { kind: 'envelope_malformed' };
}
