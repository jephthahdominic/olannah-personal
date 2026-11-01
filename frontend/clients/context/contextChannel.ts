import type { SessionIdentity } from '../session/sessionClient';

// The context object is DELIVERED to the canvas (BRD 1.0 Assumption 2); the canvas never calls the PCR directly.
// Transport is OPEN (SDD K2, Q3). request() asks the context channel to (re)deliver, which the channel forwards
// upstream. That reconciles "canvas retries delivery" (error row 2) with "never calls the PCR" (non-goal 4).
// Resolves with the RAW payload: validation happens in the runtime, never here. Rejects with a DeliveryError (contracts/delivery.ts)
// so the runtime can tell a 401 (keep the loading screen), a 404 (role undetermined) and a 504 (hard timeout) apart.
export interface ContextChannel {
  request(session: SessionIdentity): Promise<unknown>;
  /**
   * Optional. Asks for more rows of one group of a zone (the "Show 7 more jobs" button) and resolves the WHOLE zone as it should now look, in the
   * delivered shape. The canvas validates it like any zone update. Not defined by the API yet, so a channel without it makes the canvas say it
   * cannot load more.
   */
  requestMore?(zoneId: string, groupId: string): Promise<unknown>;
}
