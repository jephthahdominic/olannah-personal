import type { DeepReadonly } from '../freeze';
import type { ContextEnvelope } from '@/contracts';

// Layout resolution (BRD 1.0 UR3, SDD 6.3). Pure function of the validated context object.
// Stage 2 replaces KNOWN_LAYOUT_IDS with the real template registry; the resolution rules stay the same.

export const KNOWN_LAYOUT_IDS = ['technician', 'estimator'] as const;
export type KnownLayoutId = (typeof KNOWN_LAYOUT_IDS)[number];
export type ResolvedLayoutId = KnownLayoutId | 'default';

export interface ResolvedLayout {
  layoutId: ResolvedLayoutId;
  /** Role is known but has no registered layout: the platform default is used and an event is logged (UR3C). */
  unmappedRole: boolean;
}

export type LayoutResolution =
  | { kind: 'resolved'; layout: ResolvedLayout }
  // Role cannot be determined at all: fallback screen, no template loaded (UR3D). Distinct from unmapped.
  | { kind: 'role_undetermined' };

export function resolveLayout(context: DeepReadonly<ContextEnvelope>): LayoutResolution {
  if (context.resolvedRole === null) return { kind: 'role_undetermined' };
  const id = context.layoutConfig.layoutId;
  if ((KNOWN_LAYOUT_IDS as readonly string[]).includes(id)) {
    return { kind: 'resolved', layout: { layoutId: id as KnownLayoutId, unmappedRole: false } };
  }
  return { kind: 'resolved', layout: { layoutId: 'default', unmappedRole: true } };
}
