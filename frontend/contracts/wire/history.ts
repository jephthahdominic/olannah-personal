import type { HistoryRecord, ZoneState } from './context';

// The second delivery: job history, from the Streaming Canvas Aggregator (BRD UR9, Assumption 4). Types only; see context.ts.

/** How the aggregator cleaned the data. Informational: shown if useful, never used to decide anything. */
export interface DataQuality {
  readonly deduplicated: number;
  readonly dropped_undated: number;
  /** Sources that could not be read, so the history may be partial. */
  readonly unavailable_sources: readonly string[];
}

export interface HistoryMessage {
  readonly type: 'zone_data';
  readonly session_id: string;
  readonly zone_id: 'history';
  /**
   * Counts deliveries per session. A placeholder: whether sequence numbers are per tenant, per session or global is BRD open
   * question 4, so nothing depends on its meaning beyond "newer is larger".
   */
  readonly seq: number;
  readonly state: ZoneState;
  readonly as_of: string;
  /** Empty with `state: 'rendered'` is a valid empty history, not an error. */
  readonly data: readonly HistoryRecord[];
  readonly data_quality: DataQuality;
}
