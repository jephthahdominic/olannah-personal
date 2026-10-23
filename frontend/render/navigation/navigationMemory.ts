import { registerPurgeHandler } from '@/runtime/purgeSession';
import type { ResolvedDestination } from './assembleNavigation';

// Small module-level memory for navigation, so it lives outside React's render cycle:
//   - the last good role set (BRD 1.1 hierarchy step 1: keep it when a later layout_config arrives degraded),
//   - the events and message already emitted, so a re-assembly with an identical result never logs or toasts twice.
// It is render/orchestration state and is cleared on session purge, so nothing survives a session (ADR-010).
interface Memory {
  roles: readonly ResolvedDestination[] | null;
  eventKey: string | null;
  toast: string | null;
}

export const navigationMemory: Memory = { roles: null, eventKey: null, toast: null };

export function resetNavigationMemory(): void {
  navigationMemory.roles = null;
  navigationMemory.eventKey = null;
  navigationMemory.toast = null;
}

registerPurgeHandler(resetNavigationMemory);
