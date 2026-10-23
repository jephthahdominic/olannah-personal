import type { SessionIdentity } from '../session/sessionClient';

// The context object is DELIVERED to the canvas (BRD 1.0 Assumption 2); the canvas never calls the PCR directly.
// Transport is OPEN (SDD K2, Q3). request() asks the context channel to (re)deliver, which the channel forwards
// upstream. That reconciles "canvas retries delivery" (error row 2) with "never calls the PCR" (non-goal 4).
// Resolves with the RAW payload: validation happens in the runtime, never here.
export interface ContextChannel {
  request(session: SessionIdentity): Promise<unknown>;
}
