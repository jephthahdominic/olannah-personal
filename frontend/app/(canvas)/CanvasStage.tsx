'use client';

import { useCallback, useEffect, useMemo } from 'react';
import type { ContextEnvelope, RuntimeConfig } from '@/contracts';
import { getUpstream, upstreamMode } from '@/clients/upstream';
import type { SessionIdentity } from '@/clients/session/sessionClient';
import type { ResolvedLayout } from '@/runtime/boot/layoutRegistry';
import { CheckpointController } from '@/runtime/checkpoint/checkpointController';
import { useCanvasRuntime } from '@/runtime/canvas/useCanvasRuntime';
import { registerPurgeHandler } from '@/runtime/purgeSession';
import { toastStore } from '@/runtime/toasts';
import { messages } from '@/render/messages';
import type { DeepReadonly } from '@/runtime/freeze';
import { Shell } from '@/render/shell/Shell';
import { DevOverlay } from './DevOverlay';

// Creates the runtime for an assembled workspace and hands it to the shell. The runtime owns the connection, updates,
// refresh and history. The shell, in the render layer, never imports a client: this app-layer component is the seam.
export function CanvasStage({
  context,
  layout,
  session,
  config,
  signOut,
}: {
  context: DeepReadonly<ContextEnvelope>;
  layout: ResolvedLayout;
  session: SessionIdentity;
  config: RuntimeConfig;
  signOut: () => void;
}) {
  // The checkpoint controller is created here, in the app layer, because it needs an upstream channel and the render layer never
  // imports a client. While it is active the canvas is blocked: updates queue, refresh timers pause and toasts are held. When it
  // ends, whatever queued is applied.
  const controller = useMemo(
    () =>
      new CheckpointController({
        channel: getUpstream().checkpoint,
        session: { sessionId: session.sessionId ?? 'unknown-session', workerId: session.userId },
        texts: { accountability: messages.checkpoint.accountability },
        onActiveChange: (active) => toastStore.setHeld(active),
      }),
    [session],
  );
  const isBlocked = useCallback(() => controller.isActive(), [controller]);
  const runtime = useCanvasRuntime(context, session, config, isBlocked);
  // When the checkpoint ends, apply whatever queued while it was active and run any refresh that was held back.
  useEffect(() => {
    let wasActive = false;
    return controller.subscribe(() => {
      const active = controller.isActive();
      if (wasActive && !active) runtime.resume();
      wasActive = active;
    });
  }, [controller, runtime]);
  useEffect(() => {
    const detach = controller.attach();
    // Session end abandons an active checkpoint: nothing is submitted, and one audit stub is sent.
    const unregister = registerPurgeHandler(() => controller.dispose());
    return () => {
      unregister();
      detach();
      controller.dispose();
    };
  }, [controller]);
  return (
    <Shell
      context={context}
      layout={layout}
      runtime={runtime}
      checkpoint={controller}
      signOut={signOut}
      supportHref={config.support.contactHref}
      toastDurationMs={config.toast.durationMs}
      devTools={upstreamMode === 'mock' ? <DevOverlay runtime={runtime} /> : undefined}
    />
  );
}
