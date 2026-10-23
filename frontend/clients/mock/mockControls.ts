// Development-only switches for the mock upstream (fault injection, SDD 12.5). Read at call time by the mock channels and
// changed by the dev overlay. They exist only in mock mode and are never part of a real-mode bundle's behaviour.
export type HistoryMode = 'ok' | 'slow' | 'error' | 'empty' | 'degraded' | 'invalid';

export const mockControls = {
  historyMode: 'ok' as HistoryMode,
  historyDelayMs: 1200,
  /** Delay before a context re-delivery (refresh) answers. Set above 30,000 to exercise the staleness warning. */
  refreshDelayMs: 0,
  refreshFails: false,
  feedbackFails: false,
};

export function resetMockControls(): void {
  mockControls.historyMode = 'ok';
  mockControls.historyDelayMs = 1200;
  mockControls.refreshDelayMs = 0;
  mockControls.refreshFails = false;
  mockControls.feedbackFails = false;
}
