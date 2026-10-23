import type { IconName } from '@/components';

// The destination catalog (BRD 1.0 "Destination catalog", SDD ADR-011). Bundled as a versioned static file so it
// removes a boot-time network dependency. Each destination is defined ONCE: stable identifier, route, icon, fallback
// label, and an offline capability flag that defaults to requiring a connection. Tenant configuration may supply a
// label (via the context object); the identifier never changes regardless of label, role, tenant or order.
// Universal destinations are NOT in the catalog: they are defined by the shell (see universal.ts).
export const CATALOG_VERSION = 1;

export interface CatalogEntry {
  id: string;
  route: string;
  icon: IconName;
  fallbackLabel: string;
  /** Defaults to requiring a connection. Offline availability is supplied per session by upstream (BRD 1.1 K14). */
  offlineCapable: boolean;
}

export type DestinationCatalog = Readonly<Record<string, CatalogEntry>>;

export const destinationCatalog: DestinationCatalog = {
  'work-orders': { id: 'work-orders', route: '/work-orders', icon: 'clipboard-list', fallbackLabel: 'Work Orders', offlineCapable: false },
  assets: { id: 'assets', route: '/assets', icon: 'building-warehouse', fallbackLabel: 'Assets', offlineCapable: false },
  quotes: { id: 'quotes', route: '/quotes', icon: 'file-text', fallbackLabel: 'Quotes', offlineCapable: false },
  'field-review': { id: 'field-review', route: '/field-review', icon: 'clipboard-check', fallbackLabel: 'Field Review', offlineCapable: false },
};

/** A catalog entry is usable only if every required field is present. Anything else is omitted and logged. */
export function isValidEntry(entry: unknown): entry is CatalogEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Partial<CatalogEntry>;
  return [e.id, e.route, e.icon, e.fallbackLabel].every((v) => typeof v === 'string' && v.length > 0);
}
