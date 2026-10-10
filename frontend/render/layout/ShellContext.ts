'use client';

import { createContext, useContext } from 'react';
import type { WorkerIdentity } from '@/contracts';
import type { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import type { Viewport } from '@/tokens/tokens.generated';

// What zone content may read about the shell. Read-only: components emit events upward and never mutate this.
export interface ShellContextValue {
  layoutId: string;
  viewport: Viewport;
  worker: WorkerIdentity;
  /** Label of the active destination, or null on a screen outside the navigation set. */
  activeLabel: string | null;
  signOut: () => void;
  /** The canvas runtime. Read-only for rendering: zone content subscribes to its state and never calls its clients. */
  runtime: CanvasRuntime;
  /** Asks the shell to go to a destination by identifier. The shell performs the route transition. */
  navigate: (destinationId: string) => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside the Shell');
  return value;
}
