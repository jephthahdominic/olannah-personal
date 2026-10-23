'use client';

import { useEffect, useRef } from 'react';

// Records the element that opened a surface and restores focus to it on close (BRD 1.3 section 11.2).
// If that element has gone, focus falls back to `fallback()` when given. The canvas-wide fallback (primary-content
// heading) is the shell's decision, so it is passed in rather than assumed here.
//
// The effect depends ONLY on `open`. The fallback lives in a ref, so a new function identity on every render can never
// re-run the "opened" branch and overwrite the recorded opener with an element that is already inside the surface.
export function useFocusReturn(open: boolean, fallback?: () => HTMLElement | null): void {
  const opener = useRef<HTMLElement | null>(null);
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    fallbackRef.current = fallback;
  });

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }
    const target = opener.current;
    opener.current = null;
    if (!target) return;
    if (target.isConnected) target.focus();
    else fallbackRef.current?.()?.focus();
  }, [open]);
}
