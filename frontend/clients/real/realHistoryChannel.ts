import type { HistoryChannel } from '../history/historyChannel';

// Placeholder: the Aggregator delivery contract is OPEN (BRD 1.0 OQ5). Rejecting makes HistoryList show its unavailable
// state with an explanation, exactly as a real outage would.
export class RealHistoryChannel implements HistoryChannel {
  async request(): Promise<unknown> {
    throw new Error('history transport not implemented');
  }
}
