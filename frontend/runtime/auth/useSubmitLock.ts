'use client';

import { useCallback, useRef, useState } from 'react';

// Click-and-disable for form submission. Two layers, both needed:
//   1. A synchronous ref guard. State updates are asynchronous, so two clicks (or a click plus the Enter key) landing in
//      the same tick would BOTH see "not processing" if we relied on state alone. The ref closes that gap.
//   2. A `processing` flag for the UI, which disables the inputs and makes the button inert and visibly busy.
// The lock is released when the attempt fails or is invalid. After a SUCCESS it stays held until the page navigates, so
// a slow redirect can never produce a second submission.
export function useSubmitLock(): { processing: boolean; run: (task: () => Promise<'released' | 'held'>) => Promise<void> } {
  const locked = useRef(false);
  const [processing, setProcessing] = useState(false);

  const run = useCallback(async (task: () => Promise<'released' | 'held'>) => {
    if (locked.current) return;
    locked.current = true;
    setProcessing(true);
    let outcome: 'released' | 'held' = 'released';
    try {
      outcome = await task();
    } catch {
      outcome = 'released';
    } finally {
      if (outcome === 'released') {
        locked.current = false;
        setProcessing(false);
      }
    }
  }, []);

  return { processing, run };
}
