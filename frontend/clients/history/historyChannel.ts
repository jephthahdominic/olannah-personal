// History is DELIVERED by the Streaming Canvas Aggregator in a subsequent pass; the canvas never resolves the history
// pointer or reads a history endpoint itself (BRD 1.0 UR9C, 1.2 Assumption 4). The delivery contract is OPEN (1.0 OQ5).
// This interface models the relay: ask the approved channel for a page, and receive the RAW payload. Validation happens in
// the runtime, never here. `request-more` from HistoryList is relayed through the same channel.
export interface HistoryChannel {
  request(historyRef: string, cursor: string | null): Promise<unknown>;
}
