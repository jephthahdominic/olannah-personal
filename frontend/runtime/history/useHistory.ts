'use client';

import { useSyncExternalStore } from 'react';
import type { HistoryHydrator, HistoryState } from './historyStore';

const LOADING: HistoryState = { status: 'loading', records: [], unavailableSources: [], asOf: null };

export function useHistory(history: HistoryHydrator): HistoryState {
  return useSyncExternalStore(history.subscribe, history.getSnapshot, () => LOADING);
}
