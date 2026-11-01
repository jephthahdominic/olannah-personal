'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Wire } from '@/contracts';
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
export function useNavigation(context: DeepReadonly<Wire.ValidatedContext>, viewport: Viewport, activeId: string | null, connectionLost = false): NavigationResult {
  // The degraded fields as the navigation assembly reads them: field names only. The reasons belong to the layout resolver.
  const degradedFields = useMemo(() => context.degraded_fields.map((f) => f.field), [context]);
  // While the connection is lost, the destinations that need one carry the offline sign and explain themselves when chosen (BRD 1.1). Dashboard
  // is a universal destination and stays as it is: the last known data can still be read there.
  const needsConnection = useMemo(
    () => (connectionLost ? context.layout_config.destinations.filter((id) => destinationCatalog[id] && !destinationCatalog[id].offlineCapable) : []),
    [context, connectionLost],
  );
  const result = useMemo(
    () =>
      assembleNavigation({
        viewport,
        layoutDestinations: context.layout_config.destinations,
        degradedFields,
        catalog: destinationCatalog,
        unavailable: needsConnection,
        previousRoleDestinations: navigationMemory.roles,
        activeId,
      }),
    [context, degradedFields, viewport, activeId, needsConnection],
  );

  const announced = useRef<string | null>(null);
  const signature = result.model.items.map((i) => i.destinationId).join('|');

  useEffect(() => {
    if (!degradedFields.includes('layout_config')) navigationMemory.roles = result.model.roleDestinations;

    const eventKey = result.events.map((e) => e.event).join('|');
    if (eventKey && navigationMemory.eventKey !== eventKey) {
      for (const e of result.events) logEvent(e.event, e.severity, e.detail);
    }
    navigationMemory.eventKey = eventKey;

    if (result.toast && navigationMemory.toast !== result.toast) toastStore.push(result.toast);
    navigationMemory.toast = result.toast ?? null;
  }, [result, degradedFields]);

  useEffect(() => {
    // A set change after the first render is announced; the initial assembly is not.
    if (announced.current !== null && announced.current !== signature) liveRegion.announce('Navigation updated', 'polite');
    announced.current = signature;
  }, [signature]);

  return result;
}
