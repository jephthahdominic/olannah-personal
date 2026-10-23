'use client';

import { useSyncExternalStore } from 'react';

// Toast queue: render and orchestration state, owned by the shell (SDD 7.2). Messages are SUPPLIED text.
export interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'info';
}

type Listener = () => void;
const empty: readonly ToastItem[] = [];

class ToastStore {
  #items: readonly ToastItem[] = [];
  #held = false;
  #visible: readonly ToastItem[] = [];
  #listeners = new Set<Listener>();
  #next = 1;

  subscribe = (l: Listener): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getSnapshot = (): readonly ToastItem[] => this.#visible;

  /** While a checkpoint blocking surface is active no toast may appear. Messages are kept, in order, and surface when it ends
   *  (BRD 1.3 7.4). A held toast has not been mounted, so its display timer has not started. */
  setHeld(held: boolean): void {
    if (this.#held === held) return;
    this.#held = held;
    this.#emit();
  }
  push(message: string, tone: ToastItem['tone'] = 'info'): number {
    const id = this.#next++;
    this.#items = [...this.#items, { id, message, tone }];
    this.#emit();
    return id;
  }
  dismiss(id: number): void {
    this.#items = this.#items.filter((t) => t.id !== id);
    this.#emit();
  }
  clear(): void {
    this.#held = false;
    this.#items = [];
    this.#emit();
  }
  #emit(): void {
    this.#visible = this.#held ? empty : this.#items;
    for (const l of [...this.#listeners]) l();
  }
}

export const toastStore = new ToastStore();

export function useToasts(): readonly ToastItem[] {
  return useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => empty);
}
