'use client';

import { useEffect, useState } from 'react';

// Whole seconds left on a cooldown (0 when finished). Re-renders once a second while time remains, then stops by itself.
// `runId` changes whenever a new cooldown starts, which restarts the ticker.
export function useCountdown(remainingMs: () => number, runId: number): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (remainingMs() <= 0) return;
    const id = setInterval(() => {
      setTick((n) => n + 1);
      if (remainingMs() <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [runId, remainingMs]);

  return Math.ceil(remainingMs() / 1000);
}
