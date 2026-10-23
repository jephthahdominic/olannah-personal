import type { Category } from '@/components/manifests';

// Components in the BRD 1.2 catalogue that are not built yet. They are listed so the gallery shows the whole library and
// what is still to come. A component leaves this list when it gains a manifest (gallery.test.ts enforces that).
export interface PlannedComponent {
  name: string;
  category: Category;
  priority: 'P0' | 'P0.5';
  purpose: string;
  note: string;
}

export const PLANNED: readonly PlannedComponent[] = [];
