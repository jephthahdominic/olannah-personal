'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ConnectionStatus } from '../canvas/canvasRuntime';
import type { ZoneStore } from './zoneStore';

export type Freshness = 'fresh' | 'syncing' | 'stale';

/** One summary of freshness across the given zones, for the topbar's sync marker. Freshness and connectivity stay separate. */
export function useZoneFreshness(store: ZoneStore, keys: readonly string[], connection: ConnectionStatus): Freshness {
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubs = keys.map((k) => store.subscribe(k)(listener));
      return () => unsubs.forEach((u) => u());
    },
    [store, keys],
  );
  const snapshot = useMemo(
    () => () => {
      const states = keys.map((k) => store.get(k));
      if (connection === 'reconnecting' || connection === 'failed') return 'stale' as const;
      if (states.some((s) => s.condition === 'stale' || s.refreshDelayed)) return 'stale' as const;
      if (states.some((s) => s.refreshing)) return 'syncing' as const;
      return 'fresh' as const;
    },
    [store, keys, connection],
  );
  return useSyncExternalStore(subscribe, snapshot, () => 'fresh' as const);
}
