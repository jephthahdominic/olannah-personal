'use client';

import { useEffect } from 'react';

// BlockingScope: while a checkpoint is active the whole canvas root is inert (BRD 1.2 5.12 Feature 6, SDD 11). Nothing outside
// the checkpoint is pointer-interactive, keyboard-focusable or announced. `inert` does all of it where it exists. Where it does
// not (the Safari 15 floor), the same result is built from aria-hidden, pointer blocking and a focus guard. Page scroll is
// locked while it is active. Everything is restored exactly when it ends.
const supportsInert = () => typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;

/** The canvas root carries `data-canvas-root`. It is found by that marker rather than handed in as a ref. */
export const CANVAS_ROOT_SELECTOR = '[data-canvas-root]';

export function useBlockingScope(active: boolean): void {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR);
    if (!el || !active) return;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    const previousPointer = el.style.pointerEvents;
    html.style.overflow = 'hidden';
    el.setAttribute('aria-hidden', 'true');
    el.inert = true;
    let guard: ((event: FocusEvent) => void) | null = null;
    if (!supportsInert()) {
      el.style.pointerEvents = 'none';
      guard = (event: FocusEvent) => {
        if (event.target instanceof Node && el.contains(event.target)) document.querySelector<HTMLElement>('[data-portal="checkpoint"] [role="dialog"]')?.focus();
      };
      document.addEventListener('focusin', guard);
    }
    return () => {
      if (guard) document.removeEventListener('focusin', guard);
      el.inert = false;
      el.removeAttribute('aria-hidden');
      el.style.pointerEvents = previousPointer;
      html.style.overflow = previousOverflow;
    };
  }, [active]);
}
