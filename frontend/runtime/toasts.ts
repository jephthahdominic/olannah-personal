'use client';

import { useSyncExternalStore } from 'react';

// Toast queue: render and orchestration state, owned by the shell (SDD 7.2). Messages are SUPPLIED text.
export interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'info';
}

type Listener = () => void;

class ToastStore {
  #items: readonly ToastItem[] = [];
  #listeners = new Set<Listener>();
  #next = 1;

  subscribe = (l: Listener): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getSnapshot = (): readonly ToastItem[] => this.#items;

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
    this.#items = [];
    this.#emit();
  }
  #emit(): void {
    for (const l of [...this.#listeners]) l();
  }
}

export const toastStore = new ToastStore();
const empty: readonly ToastItem[] = [];

export function useToasts(): readonly ToastItem[] {
  return useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => empty);
}
