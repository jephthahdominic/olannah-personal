// History is DELIVERED by the Streaming Canvas Aggregator in a subsequent pass; the canvas never builds, edits or resolves the
// history pointer (BRD 1.0 UR9C, 1.2 Assumption 4). This interface models the relay: hand the approved channel the opaque pointer
// from the context object, and receive the RAW payload. Validation happens in the runtime, never here. Rejects with a
// DeliveryError (contracts/delivery.ts): an unknown pointer is `unknown_pointer`. The practice API returns the whole history in one
// message, so there is no cursor.
export interface HistoryChannel {
  request(pointer: string): Promise<unknown>;
}
