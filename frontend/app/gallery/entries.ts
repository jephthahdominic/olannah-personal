import { manifests, type Category } from '@/components/manifests';
import { PLANNED } from './planned';
import { PURPOSES } from './purposes';

export interface GalleryEntry {
  name: string;
  category: Category;
  priority: 'P0' | 'P0.5';
  purpose: string;
  built: boolean;
  /** Events the component emits upward (BRD 1.2 5.2 Feature 2C). Built components only. */
  events: readonly string[];
  persistenceCapable: boolean;
  /** Why a component is not built yet. Planned components only. */
  note?: string;
}

// The gallery lists the whole BRD 1.2 catalogue: every built component (from its manifest, so the gallery cannot drift from
// the library) followed by the components still to come.
export function buildEntries(): GalleryEntry[] {
  const built: GalleryEntry[] = Object.values(manifests).map((m) => ({
    name: m.name,
    category: m.category,
    priority: m.priority,
    purpose: PURPOSES[m.name] ?? '',
    built: true,
    events: m.events,
    persistenceCapable: m.lifecycle === 'persistence-capable',
  }));
  const planned: GalleryEntry[] = PLANNED.map((p) => ({ name: p.name, category: p.category, priority: p.priority, purpose: p.purpose, built: false, events: [], persistenceCapable: false, note: p.note }));
  return [...built, ...planned];
}
