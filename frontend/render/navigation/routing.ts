import { destinationCatalog } from './catalog';
import { UNIVERSAL_ROUTES } from './universal';

// The URL carries the current destination so a reload returns to the same place with no storage (ADR-010).
// Matching and restoration use destination IDENTIFIERS, never labels or routes held elsewhere.

const ROUTE_TO_ID: Record<string, string> = {
  ...UNIVERSAL_ROUTES,
  ...Object.fromEntries(Object.values(destinationCatalog).map((e) => [e.route, e.id])),
};

/** Returns the destination id for a pathname, or null for a screen outside the navigation set (nothing is active). */
export function destinationIdForPath(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ROUTE_TO_ID[clean] ?? null;
}

export function routeForDestination(id: string): string | null {
  if (id === 'dashboard') return '/';
  if (id === 'settings') return '/settings';
  return destinationCatalog[id]?.route ?? null;
}

/** All known destination paths, used to pre-render the canvas entry for each. */
export function knownRoutes(): string[] {
  return Object.keys(ROUTE_TO_ID);
}
