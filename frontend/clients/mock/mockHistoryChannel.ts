import type { HistoryChannel } from '../history/historyChannel';
import { mockControls } from './mockControls';

// The freezer scenario shown in the approved designs (Northgate Grocers, FZ-02). Site-local dates.
const RECORDS = [
  { id: 'h9', occurredOn: '2026-09-21', title: 'Slow recovery after delivery', summary: 'No parts used.' },
  { id: 'h8', occurredOn: '2026-09-04', title: 'Evaporator ice cleared', summary: 'Controller observed.' },
  { id: 'h7', occurredOn: '2026-08-12', title: 'Defrost sensor reset', summary: 'Temporary recovery.' },
  { id: 'h6', occurredOn: '2026-07-02', title: 'Door gasket replaced' },
  { id: 'h5', occurredOn: '2026-05-19', title: 'Preventive maintenance', summary: 'No faults found.' },
  { id: 'h4', occurredOn: '2026-03-30', title: 'Fan motor inspected' },
  { id: 'h3', occurredOn: '2026-01-14', title: 'Compressor check', summary: 'Within tolerance.' },
  { id: 'h2', occurredOn: '2025-11-08', title: 'Refrigerant level verified' },
];
const PAGE = 3;

export class MockHistoryChannel implements HistoryChannel {
  async request(_historyRef: string, cursor: string | null): Promise<unknown> {
    const mode = mockControls.historyMode;
    if (mode === 'slow') await new Promise((r) => setTimeout(r, mockControls.historyDelayMs * 10));
    else await new Promise((r) => setTimeout(r, mockControls.historyDelayMs));
    if (mode === 'error') throw new Error('history unavailable');
    if (mode === 'invalid') return { records: 'nope' };
    if (mode === 'empty') return { records: [], nextCursor: null };

    const start = cursor ? Number(cursor) : 0;
    const records = RECORDS.slice(start, start + PAGE);
    const next = start + PAGE < RECORDS.length ? String(start + PAGE) : null;
    return { records, nextCursor: next, ...(mode === 'degraded' ? { degradedMessage: 'Some older records could not be loaded.' } : {}) };
  }
}
