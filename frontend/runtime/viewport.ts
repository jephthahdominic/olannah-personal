'use client';

import { useSyncExternalStore } from 'react';
import { BREAKPOINTS, type Viewport } from '@/tokens/tokens.generated';

// Single source for the breakpoint (SDD 9.6), so the rail, tab bar and More menu can never disagree.
export function viewportForWidth(width: number): Viewport {
  if (width <= BREAKPOINTS.mobileMax) return 'mobile';
  if (width <= BREAKPOINTS.tabletMax) return 'tablet';
  return 'desktop';
}

const QUERIES = [`(max-width: ${BREAKPOINTS.mobileMax}px)`, `(max-width: ${BREAKPOINTS.tabletMax}px)`];

function subscribe(onChange: () => void): () => void {
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', onChange));
  return () => lists.forEach((l) => l.removeEventListener('change', onChange));
}

const snapshot = (): Viewport => viewportForWidth(window.innerWidth);
// Mobile-first: the server render and first client render are the mobile layout (BRD 1.3 section 6.1).
const serverSnapshot = (): Viewport => 'mobile';

export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
