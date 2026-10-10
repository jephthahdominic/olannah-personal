'use client';

import { useCallback, type KeyboardEvent, type RefObject } from 'react';

// Keeps focus inside an open overlay until it is dismissed (BRD 1.3 section 11.2: focus is constrained in modal and drawer
// contexts, and nowhere else). Escape asks to close. Returns a keydown handler for the overlay's root.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(container: RefObject<HTMLElement | null>, onEscape: () => void) {
  return useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = container.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [container, onEscape],
  );
}

/** Moves focus to the first focusable element inside the container (or the container itself). */
export function focusFirst(container: HTMLElement | null): void {
  if (!container) return;
  (container.querySelector<HTMLElement>(FOCUSABLE) ?? container).focus();
}
