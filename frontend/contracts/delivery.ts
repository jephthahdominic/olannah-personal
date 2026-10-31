// How a delivery can fail, as the canvas needs to tell the failures apart (BRD section 6, error taxonomy). A failure is a
// typed value with a kind, never a status code shown to the worker.
//
//   unauthorized       401  Session not confirmed. Stay on the loading screen: never render the workspace before login
//                           is confirmed (UR1). Not an error screen.
//   role_undetermined  404  The worker's role cannot be determined. Fallback screen, no layout template (UR3D). Different
//                           from an UNMAPPED role, which is a normal delivery carrying a flag.
//   timeout            504  Hard timeout (10,000 ms). Workspace recovery screen, structured timeout event (row 3).
//   unreachable             The network or the server could not be reached at all. Treated like a missing delivery: the
//                           boot machine's waiting states end at the degraded and recovery screens.
//   server_error       5xx  Anything else the server answered. Same treatment as unreachable.
//   unknown_pointer    404  History only: the pointer is not known. The history zone shows its unavailable state.
export type DeliveryFailureKind = 'unauthorized' | 'role_undetermined' | 'timeout' | 'unreachable' | 'server_error' | 'unknown_pointer';

/** Thrown by a delivery channel in place of resolving. Carries no payload, URL, header or token: it is safe to log. */
export class DeliveryError extends Error {
  readonly kind: DeliveryFailureKind;
  constructor(kind: DeliveryFailureKind) {
    super(`delivery failed: ${kind}`);
    this.name = 'DeliveryError';
    this.kind = kind;
  }
}

export const isDeliveryError = (value: unknown): value is DeliveryError => value instanceof DeliveryError;
