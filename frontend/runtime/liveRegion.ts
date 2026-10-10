'use client';

import { useSyncExternalStore } from 'react';

// Two global live regions, polite and assertive (SDD 9.6). Identical messages inside a short window are de-duplicated
// so a screen reader never announces the same change twice. The checkpoint appearance will use `assertive` (P0).
export type Politeness = 'polite' | 'assertive';
export interface Announcements {
  polite: string;
  assertive: string;
}

const DEDUPE_MS = 1000;

class LiveRegionManager {
  #state: Announcements = { polite: '', assertive: '' };
  #listeners = new Set<() => void>();
  #last: Record<Politeness, { text: string; at: number }> = { polite: { text: '', at: 0 }, assertive: { text: '', at: 0 } };

  subscribe = (l: () => void): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getSnapshot = (): Announcements => this.#state;

  announce(text: string, politeness: Politeness = 'polite'): void {
    const now = Date.now();
    const last = this.#last[politeness];
    if (last.text === text && now - last.at < DEDUPE_MS) return;
    this.#last[politeness] = { text, at: now };
    this.#state = { ...this.#state, [politeness]: text };
    for (const l of [...this.#listeners]) l();
  }

  clear(): void {
    this.#state = { polite: '', assertive: '' };
    this.#last = { polite: { text: '', at: 0 }, assertive: { text: '', at: 0 } };
    for (const l of [...this.#listeners]) l();
  }
}

export const liveRegion = new LiveRegionManager();
const server: Announcements = { polite: '', assertive: '' };

export function useAnnouncements(): Announcements {
  return useSyncExternalStore(liveRegion.subscribe, liveRegion.getSnapshot, () => server);
}
