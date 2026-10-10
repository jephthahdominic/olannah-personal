'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getUpstream } from '@/clients/upstream';
import { sessionClient } from '@/clients/session/sessionClient';
import { loadRuntimeConfig } from '@/clients/config/runtimeConfigClient';
import { BootController } from './bootController';
import { initialBootState, type BootState } from './bootMachine';
import { logEvent } from '../telemetry';
import type { RuntimeConfig } from '@/contracts';
import { DEFAULT_RUNTIME_CONFIG } from '@/contracts';

const noopSubscribe = () => () => {};
const initialSnapshot = () => initialBootState;

export interface UseBoot {
  state: BootState;
  config: RuntimeConfig;
  retry: () => void;
}

/**
 * Starts the boot sequence on mount. The server render and first client render are always `awaitingSession`, so the
 * loading screen is part of the initial HTML and paints without waiting for JavaScript (BRD 1.0 UR1).
 */
export function useBoot(): UseBoot {
  const [controller, setController] = useState<BootController | null>(null);
  const [config, setConfig] = useState<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);

  useEffect(() => {
    let cancelled = false;
    let created: BootController | null = null;

    void loadRuntimeConfig().then(({ config: loaded, usedDefaults }) => {
      if (cancelled) return;
      if (usedDefaults) logEvent('config.invalid', 'warn');
      const { auth, context } = getUpstream();
      created = new BootController({ auth, context, sessionClient, config: loaded });
      created.start();
      setConfig(loaded);
      setController(created);
    });

    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, []);

  const state = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getState ?? initialSnapshot,
    initialSnapshot,
  );

  const retry = useCallback(() => controller?.retry(), [controller]);
  return { state, config, retry };
}
