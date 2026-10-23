'use client';

import { startTransition, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ContextEnvelope, RuntimeConfig } from '@/contracts';
import { getUpstream } from '@/clients/upstream';
import type { SessionIdentity } from '@/clients/session/sessionClient';
import type { DeepReadonly } from '../freeze';
import { CanvasRuntime, type ConnectionStatus } from './canvasRuntime';

/**
 * Builds the runtime for an assembled workspace. Construction is pure (it only initialises the zone store from the
 * context object), so the first render already has data; the connection, timers and history start in an effect and stop on
 * cleanup. Store writes are wrapped in a transition so a refresh never blocks input elsewhere (BRD 1.0 UR6C).
 */
export function useCanvasRuntime(context: DeepReadonly<ContextEnvelope>, session: SessionIdentity, config: RuntimeConfig, isBlocked?: () => boolean): CanvasRuntime {
  const runtime = useMemo(
    () => new CanvasRuntime({ context, session, config, upstream: getUpstream(), applyBatch: (apply) => startTransition(apply), isBlocked }),
    [context, session, config, isBlocked],
  );

  useEffect(() => {
    runtime.start();
    return () => runtime.dispose();
  }, [runtime]);

  return runtime;
}

export function useConnection(runtime: CanvasRuntime): ConnectionStatus {
  return useSyncExternalStore(runtime.subscribeConnection, runtime.getConnection, () => 'connecting' as const);
}
