import type { NavItemModel } from '@/components';
import type { Viewport } from '@/tokens/tokens.generated';
import type { LogRequest } from '@/runtime/boot/bootMachine';
import { messages } from '../messages';
import { isValidEntry, type DestinationCatalog } from './catalog';
import { universalFor } from './universal';

// Navigation assembly (SDD 10.2) is a pure function from inputs the shell already holds to a navigation model. It is
// the ONE place the degradation hierarchy of BRD 1.1 section 1.6 is implemented:
//   1 keep the last good set  ->  2 omit the bad destination, render the rest in order  ->  3 universal items only
//   ->  4 navigation recovery surface (a boundary, handled elsewhere).
// It contains no role logic and no permission checks: visibility follows the layout configuration only.

export interface ResolvedDestination {
  id: string;
  route: string;
  label: string;
  icon: NavItemModel['icon'];
}

export interface NavigationInput {
  viewport: Viewport;
  /** Ordered, role-determined destination identifiers from layout_config. Universal destinations are never in it. */
  layoutDestinations: readonly string[];
  degradedFields: readonly string[];
  /** null means the catalog is unavailable. */
  catalog: DestinationCatalog | null;
  tenantLabels?: Readonly<Record<string, string>>;
  /** Destinations that cannot currently be reached, supplied. */
  unavailable?: readonly string[];
  /** Last good role destinations, kept when a later update arrives degraded. Not viewport-specific. */
  previousRoleDestinations?: readonly ResolvedDestination[] | null;
  /** The active destination identifier, supplied by the shell. Components never compute it. */
  activeId: string | null;
}

export interface NavigationModel {
  /** Tab bar items on mobile (at most five), or rail items on tablet and desktop. */
  items: NavItemModel[];
  /** Mobile only: role destinations that did not fit, shown in the More menu in order. */
  overflow: NavItemModel[];
  /** The role destinations this model was built from, to be kept as "previous". */
  roleDestinations: ResolvedDestination[];
}

export interface NavigationResult {
  model: NavigationModel;
  /** One-time worker message, supplied from the catalogue. */
  toast?: string;
  events: LogRequest[];
}

const MAX_MOBILE_ROLE_ITEMS = 3; // Dashboard + up to three role items + More = five

export function assembleNavigation(input: NavigationInput): NavigationResult {
  const events: LogRequest[] = [];
  const { leading, trailing } = universalFor(input.viewport);

  let roleDestinations: ResolvedDestination[];
  let toast: string | undefined;

  if (input.degradedFields.includes('layout_config')) {
    events.push({ event: 'nav.layout_degraded', severity: 'warn' });
    if (input.previousRoleDestinations) {
      // Mid-session: ignore the degraded update, keep the last good set, say nothing to the worker.
      roleDestinations = [...input.previousRoleDestinations];
    } else {
      // At session start: universal items only, with one message.
      roleDestinations = [];
      toast = messages.nav.degradedStart;
    }
  } else if (!input.catalog) {
    events.push({ event: 'nav.catalog_unavailable', severity: 'error' });
    roleDestinations = [];
    toast = messages.nav.degradedStart;
  } else {
    roleDestinations = resolveRoleDestinations(input, input.catalog, events);
  }

  const unavailable = new Set(input.unavailable ?? []);
  const toItem = (d: { id: string; label: string; icon: NavItemModel['icon'] }): NavItemModel => ({
    id: d.id,
    label: d.label,
    icon: d.icon,
    active: input.activeId === d.id,
    ...(unavailable.has(d.id) ? { unavailable: true, unavailableReason: messages.nav.unavailableReason } : {}),
  });

  const leadingItem = toItem(leading);

  let items: NavItemModel[];
  let overflow: NavItemModel[] = [];

  if (input.viewport === 'mobile') {
    const shown = roleDestinations.slice(0, MAX_MOBILE_ROLE_ITEMS).map(toItem);
    overflow = roleDestinations.slice(MAX_MOBILE_ROLE_ITEMS).map(toItem);
    // When the current destination is an overflow item, More shows the active state visually (BRD 1.1 UR7).
    const moreActive = overflow.some((o) => o.active);
    items = [leadingItem, ...shown, { id: trailing.id, label: trailing.label, icon: trailing.icon, active: moreActive }];
  } else {
    items = [
      leadingItem,
      ...roleDestinations.map(toItem),
      { id: trailing.id, label: trailing.label, icon: trailing.icon, active: input.activeId === trailing.id, pinned: true },
    ];
  }

  return { model: { items, overflow, roleDestinations }, ...(toast ? { toast } : {}), events };
}

function resolveRoleDestinations(input: NavigationInput, catalog: DestinationCatalog, events: LogRequest[]): ResolvedDestination[] {
  const seen = new Set<string>();
  const out: ResolvedDestination[] = [];
  for (const id of input.layoutDestinations) {
    // The persona registry rejects duplicates; if one still arrives, keep the first and suppress the rest.
    if (seen.has(id)) {
      events.push({ event: 'nav.duplicate_destination', severity: 'warn' });
      continue;
    }
    seen.add(id);

    const entry = catalog[id];
    if (!entry) {
      // Unknown identifier: omit it, render the rest in order, log. Never invent a destination.
      events.push({ event: 'nav.unknown_destination', severity: 'warn' });
      continue;
    }
    if (!isValidEntry(entry)) {
      events.push({ event: 'nav.destination_invalid', severity: 'warn' });
      continue;
    }
    out.push({ id: entry.id, route: entry.route, label: input.tenantLabels?.[id] ?? entry.fallbackLabel, icon: entry.icon });
  }
  return out;
}
