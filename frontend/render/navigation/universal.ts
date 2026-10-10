import type { IconName } from '@/components';
import type { Viewport } from '@/tokens/tokens.generated';

// Universal destinations are defined by the SHELL, not the destination catalog or the persona registry (BRD 1.0 SR24).
// They render for every confirmed session regardless of role, viewport or registry contents. Neither the registry nor
// the catalog can override or remove them. Dashboard everywhere; More on mobile; Settings on tablet and desktop.
export interface UniversalDestination {
  id: 'dashboard' | 'more' | 'settings';
  route: string | null; // More is a menu, not a route
  icon: IconName;
  label: string;
}

const DASHBOARD: UniversalDestination = { id: 'dashboard', route: '/', icon: 'layout-dashboard', label: 'Dashboard' };
const MORE: UniversalDestination = { id: 'more', route: null, icon: 'dots', label: 'More' };
const SETTINGS: UniversalDestination = { id: 'settings', route: '/settings', icon: 'settings', label: 'Settings' };

export function universalFor(viewport: Viewport): { leading: UniversalDestination; trailing: UniversalDestination } {
  return { leading: DASHBOARD, trailing: viewport === 'mobile' ? MORE : SETTINGS };
}

/** Routes owned by the shell, for active-state matching. */
export const UNIVERSAL_ROUTES: Readonly<Record<string, string>> = {
  '/': 'dashboard',
  '/settings': 'settings',
};
