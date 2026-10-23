import { z } from 'zod';

// DRAFT. The Human Checkpoint contracts (BRD 1.2 5.10, BRD 1.3 8.7 and 11.6, SDD section 11). BRD 1.4 owns the protocol and is
// NOT in the repo, so every shape and every window below is the canvas's own frozen draft, to be re-verified against 1.4 and
// agreed with the Trigger Logic and the connector framework (SDD K7 trigger, K8 diff). The canvas renders what these carry.
// It never decides that a checkpoint is needed, never edits the diff, and never sends the executable payload.
export const SUPPORTED_CHECKPOINT_VERSIONS = ['1.0'] as const;
export const isSupportedCheckpointVersion = (v: unknown): boolean => typeof v === 'string' && (SUPPORTED_CHECKPOINT_VERSIONS as readonly string[]).includes(v);

const nonEmpty = z.string().min(1);

/** The signal that a human decision is needed. Carries the source and description the worker reads first. */
export const CheckpointTriggerSchema = z.object({
  schemaVersion: nonEmpty,
  checkpointId: nonEmpty,
  /** What raised the checkpoint, for example an agent or workflow name. SUPPLIED text. */
  triggeredBy: nonEmpty,
  /** Plain-language description of the decision. SUPPLIED text. */
  description: nonEmpty,
});
export type CheckpointTrigger = z.infer<typeof CheckpointTriggerSchema>;

export const DiffFieldSchema = z.object({
  id: nonEmpty,
  /** Field name by its specific meaning, for example "Resolution date". */
  label: nonEmpty,
  /** `null` when the field has no current value. Rendered as supplied, never transformed. */
  current: z.string().nullable(),
  proposed: z.string(),
});
export type DiffField = z.infer<typeof DiffFieldSchema>;

/** Exactly what will be written. Read-only, and immutable for the life of the checkpoint. */
export const DiffPayloadSchema = z.object({
  schemaVersion: nonEmpty,
  checkpointId: nonEmpty,
  targetSystem: nonEmpty,
  recordId: nonEmpty,
  originatingAgent: nonEmpty,
  fields: z.array(DiffFieldSchema).min(1),
  /** An immutable reference to the proposed write. The decision carries THIS, never the executable payload. */
  payloadReference: nonEmpty,
});
export type DiffPayload = z.infer<typeof DiffPayloadSchema>;

export const DECISIONS = ['approve', 'reject'] as const;
export type Decision = (typeof DECISIONS)[number];

/** The decision event. `eventId` is generated ONCE per checkpoint instance and reused on every retry, so a retry can never
 *  record a second decision. */
export const DecisionEventSchema = z.object({
  checkpointId: nonEmpty,
  eventId: nonEmpty,
  sessionId: nonEmpty,
  workerId: nonEmpty,
  decidedAt: z.string(),
  decision: z.enum(DECISIONS),
  payloadReference: nonEmpty,
});
export type DecisionEvent = z.infer<typeof DecisionEventSchema>;

/** Every checkpoint ends in exactly one of these, with a worker message and one audit stub. No ambiguous end state. */
export const TERMINAL_OUTCOMES = [
  'approved',
  'rejected',
  'timeout',
  'session_abandoned',
  'render_failure',
  'diff_load_failure',
  'payload_mismatch',
  'upstream_mutation',
  'reconnection_validation_failure',
  'component_load_failure',
  'approval_submission_failure',
  'rejection_submission_failure',
] as const;
export type TerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];

/** What the worker is told, by outcome. `submitted` is true ONLY when a decision reached the upstream and was acknowledged.
 *  Even then the copy says "submitted", never "completed": the write itself happens upstream. */
export const OUTCOME_SUBMITTED: Readonly<Record<TerminalOutcome, boolean>> = {
  approved: true,
  rejected: true,
  timeout: false,
  session_abandoned: false,
  render_failure: false,
  diff_load_failure: false,
  payload_mismatch: false,
  upstream_mutation: false,
  reconnection_validation_failure: false,
  component_load_failure: false,
  approval_submission_failure: false,
  rejection_submission_failure: false,
};

/** A separate event, one attempt per terminal state, that never blocks dismissal. No credentials or tokens, ever. */
export const AuditStubSchema = z.object({
  checkpointId: nonEmpty,
  eventId: z.string().nullable(),
  sessionId: nonEmpty,
  workerId: nonEmpty,
  at: z.string(),
  outcome: z.enum(TERMINAL_OUTCOMES),
  /** Allow-listed diff field LABELS only (see auditableFields). Never values. */
  diffFields: z.array(z.string()),
  /** The accountability statement exactly as it was rendered. */
  accountabilityText: z.string(),
});
export type AuditStub = z.infer<typeof AuditStubSchema>;

/** The result of asking the upstream whether a held checkpoint is still valid after a connection loss. */
export const ValidationResultSchema = z.object({ checkpointId: nonEmpty, valid: z.boolean() });
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/** What the upstream says about a submitted decision. Anything other than acknowledged is a failure the worker is told about. */
export type DecisionAck = { status: 'acknowledged' } | { status: 'payload_mismatch' } | { status: 'upstream_mutation' };

/** Windows, all configurable without a code change (proposed values; BRD 1.4 owns them). */
export interface CheckpointTimings {
  /** Longest wait for the diff after a trigger. */
  diffWaitMs: number;
  /** Inactivity before the worker is warned, and before the checkpoint expires. Timestamp-based. */
  inactivityWarnMs: number;
  inactivityExpireMs: number;
  /** Longest wait for a validation result after a lost connection is restored. */
  validationMs: number;
  /** How long a failed submission may be retried (same event id) before it fails. */
  retryWindowMs: number;
  retryDelayMs: number;
  /** How long an armed approval waits for its confirming second action. */
  confirmWindowMs: number;
}
export const DEFAULT_CHECKPOINT_TIMINGS: CheckpointTimings = {
  diffWaitMs: 3000,
  inactivityWarnMs: 8 * 60_000,
  inactivityExpireMs: 10 * 60_000,
  validationMs: 2000,
  retryWindowMs: 5000,
  retryDelayMs: 1000,
  confirmWindowMs: 5000,
};

/** The only diff facts that may enter an audit stub: field labels. Pure and allow-listed, so a value can never leak. */
export const auditableFields = (diff: DiffPayload | null): string[] => (diff ? diff.fields.map((f) => f.label) : []);
