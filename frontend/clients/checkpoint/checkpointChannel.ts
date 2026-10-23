import type { AuditStub, DecisionAck, DecisionEvent } from '@/contracts';

// The checkpoint's upstream seam (DRAFT; trigger K7 and diff K8 are OPEN, SDD Appendix C). The controller validates everything
// that comes back through this channel: `unknown` here is deliberate, so nothing is trusted before the contract schemas run.
export interface CheckpointListener {
  /** A checkpoint trigger arrived. The controller validates it and mounts the surface only if it is well formed. */
  trigger(raw: unknown): void;
  /** The upstream changed the thing under review. The checkpoint ends and is reissued upstream with a new identifier. */
  upstreamChange(checkpointId: string): void;
}

export interface CheckpointChannel {
  subscribe(listener: CheckpointListener): () => void;
  /** Resolves with the diff payload for this checkpoint. */
  fetchDiff(checkpointId: string): Promise<unknown>;
  /** Resolves with the upstream's acknowledgment. REJECTS if the decision did not reach it (the controller retries inside its
   *  window, reusing the same event id, so a retry can never record a second decision). */
  submitDecision(event: DecisionEvent): Promise<DecisionAck>;
  /** One attempt per terminal state. Never blocks dismissal, and a failure here is never shown to the worker. */
  submitAudit(stub: AuditStub): Promise<void>;
  /** After a connection loss: is this checkpoint still the same valid, immutable instance? */
  validate(checkpointId: string): Promise<unknown>;
}
