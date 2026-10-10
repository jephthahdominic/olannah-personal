'use client';

import type { NavItemModel } from '@/components';
import { Button, NavigationRail, TabBar } from '@/components';
import { logEvent } from '@/runtime/telemetry';
import { toastStore } from '@/runtime/toasts';
import type { Viewport } from '@/tokens/tokens.generated';
import { ErrorBoundary } from '../layout/ErrorBoundary';
import { messages } from '../messages';
import styles from './NavigationZone.module.css';

interface NavigationZoneProps {
  viewport: Viewport;
  items: readonly NavItemModel[];
  onSelect: (id: string) => void;
  menuOpen: boolean;
  /** Recovery: take the worker to Dashboard. */
  onDashboard: () => void;
}

// The Navigation Zone renders on Evergreen Dark in every environment and never changes surface color (BRD 1.3 section 7).
// It is wrapped in its own boundary: if a navigation component fails, ONLY this zone swaps to the recovery surface.
export function NavigationZone({ viewport, items, onSelect, menuOpen, onDashboard }: NavigationZoneProps) {
  return (
    <ErrorBoundary
      onError={() => {
        logEvent('nav.component_failure', 'error', 'render_error');
        // One supplied plain-language message, shown once as a toast.
        toastStore.push(messages.nav.failed);
      }}
      fallback={(reset) => <NavigationRecoverySurface viewport={viewport} onDashboard={onDashboard} onRefresh={reset} />}
    >
      {viewport === 'mobile' ? (
        <TabBar items={items} ariaLabel={messages.nav.primaryLabel} onSelect={onSelect} menuItemId="more" menuOpen={menuOpen} />
      ) : (
        <NavigationRail items={items} ariaLabel={messages.nav.primaryLabel} onSelect={onSelect} />
      )}
    </ErrorBoundary>
  );
}

// Shell-owned fallback (BRD 1.0 error row 14). Composed ONLY from foundation components: no navigation components are
// used, so it cannot fail for the same reason. Shows Dashboard and Refresh and nothing else.
export function NavigationRecoverySurface({ viewport, onDashboard, onRefresh }: { viewport: Viewport; onDashboard: () => void; onRefresh: () => void }) {
  return (
    <div className={`${styles.recovery} ${viewport === 'mobile' ? styles.bar : styles.rail}`} role="group" aria-label={messages.nav.primaryLabel}>
      <Button label={messages.nav.recoveryDashboard} variant="accent" onActivate={onDashboard} />
      <Button label={messages.nav.recoveryRefresh} variant="accent" onActivate={onRefresh} />
    </div>
  );
}
