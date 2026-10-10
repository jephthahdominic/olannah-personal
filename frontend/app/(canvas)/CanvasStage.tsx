'use client';

import type { ContextEnvelope, RuntimeConfig } from '@/contracts';
import { upstreamMode } from '@/clients/upstream';
import type { SessionIdentity } from '@/clients/session/sessionClient';
import type { ResolvedLayout } from '@/runtime/boot/layoutRegistry';
import { useCanvasRuntime } from '@/runtime/canvas/useCanvasRuntime';
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
  const runtime = useCanvasRuntime(context, session, config);
  return (
    <Shell
      context={context}
      layout={layout}
      runtime={runtime}
      signOut={signOut}
      supportHref={config.support.contactHref}
      toastDurationMs={config.toast.durationMs}
      devTools={upstreamMode === 'mock' ? <DevOverlay runtime={runtime} /> : undefined}
    />
  );
}
