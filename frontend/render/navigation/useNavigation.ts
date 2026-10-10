'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ContextEnvelope } from '@/contracts';
import type { DeepReadonly } from '@/runtime/freeze';
import { liveRegion } from '@/runtime/liveRegion';
import { logEvent } from '@/runtime/telemetry';
import { toastStore } from '@/runtime/toasts';
import type { Viewport } from '@/tokens/tokens.generated';
import { assembleNavigation, type NavigationResult } from './assembleNavigation';
import { destinationCatalog } from './catalog';
import { navigationMemory } from './navigationMemory';

// Binds the pure assembly function to React: logs each distinct result's events once, shows its one-time message,
// remembers the last good role set for mid-session degradation, and announces set changes politely (BRD 1.1, P1).
export function useNavigation(context: DeepReadonly<ContextEnvelope>, viewport: Viewport, activeId: string | null): NavigationResult {
  const result = useMemo(
    () =>
      assembleNavigation({
        viewport,
        layoutDestinations: context.layoutConfig.destinations,
        degradedFields: context.degradedFields,
        catalog: destinationCatalog,
        tenantLabels: context.tenantLabels,
        unavailable: context.unavailableDestinations,
        previousRoleDestinations: navigationMemory.roles,
        activeId,
      }),
    [context, viewport, activeId],
  );

  const announced = useRef<string | null>(null);
  const signature = result.model.items.map((i) => i.id).join('|');

  useEffect(() => {
    if (!context.degradedFields.includes('layout_config')) navigationMemory.roles = result.model.roleDestinations;

    const eventKey = result.events.map((e) => e.event).join('|');
    if (eventKey && navigationMemory.eventKey !== eventKey) {
      for (const e of result.events) logEvent(e.event, e.severity, e.detail);
    }
    navigationMemory.eventKey = eventKey;

    if (result.toast && navigationMemory.toast !== result.toast) toastStore.push(result.toast);
    navigationMemory.toast = result.toast ?? null;
  }, [result, context.degradedFields]);

  useEffect(() => {
    // A set change after the first render is announced; the initial assembly is not.
    if (announced.current !== null && announced.current !== signature) liveRegion.announce('Navigation updated', 'polite');
    announced.current = signature;
  }, [signature]);

  return result;
}
