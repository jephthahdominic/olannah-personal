import type { HistoryChannel } from '../history/historyChannel';
import { DeliveryError } from '@/contracts';
import { mockControls } from './mockControls';
import { emptyHistory, malformedHistory, mockHistoryFor, partialHistory } from './mockContexts';

// The practice API's own history responses. `historyMode` switches between the cases the dev overlay can show.
export class MockHistoryChannel implements HistoryChannel {
  async request(pointer: string): Promise<unknown> {
    const mode = mockControls.historyMode;
    if (mode === 'slow') await new Promise((r) => setTimeout(r, mockControls.historyDelayMs * 10));
    else await new Promise((r) => setTimeout(r, mockControls.historyDelayMs));
    if (mode === 'error') throw new DeliveryError('server_error');
    if (mode === 'invalid') return malformedHistory();
    if (mode === 'empty') return emptyHistory();
    if (mode === 'degraded') return partialHistory();
    return mockHistoryFor(pointer);
  }
}
