import type { DeepReadonly } from '../freeze';
import type { Wire } from '@/contracts';

// Layout resolution (BRD 1.0 UR3, SDD 6.3). A pure function of the validated context object.
//
// The template is picked by `layout_config.template_id`. An unmapped role is a FLAG the PCR raises in `degraded_fields` (field
// `layout`, reason `unmapped_role`): the canvas READS it and never infers it from missing layout data (UR3C). A role that cannot be
// determined at all is not in the context object: it is the delivery's 404, handled before a context exists (UR3D).

/** Template ids the canvas has, mapped to the layout each one loads. A new persona adds a row here and a template, nothing else. */
export const TEMPLATE_LAYOUTS = {
  'technician.v1': 'technician',
  'estimator.v1': 'estimator',
} as const;
export type KnownLayoutId = (typeof TEMPLATE_LAYOUTS)[keyof typeof TEMPLATE_LAYOUTS];
export type ResolvedLayoutId = KnownLayoutId | 'default';

export interface ResolvedLayout {
  layoutId: ResolvedLayoutId;
  /** The PCR flagged the role as known but unmapped: the platform default is used and an event is logged (UR3C). */
  unmappedRole: boolean;
  /** The template id is one this canvas does not have, and the PCR raised no flag. The default is used. NOT reported as an unmapped role. */
  unknownTemplate: boolean;
}

const isUnmappedFlag = (f: Wire.DegradedField) => f.field === 'layout' && f.reason === 'unmapped_role';

export function resolveLayout(context: DeepReadonly<Pick<Wire.ContextObject, 'layout_config' | 'degraded_fields'>>): ResolvedLayout {
  if (context.degraded_fields.some(isUnmappedFlag)) return { layoutId: 'default', unmappedRole: true, unknownTemplate: false };
  const known = (TEMPLATE_LAYOUTS as Record<string, KnownLayoutId | undefined>)[context.layout_config.template_id];
  if (known) return { layoutId: known, unmappedRole: false, unknownTemplate: false };
  return { layoutId: 'default', unmappedRole: false, unknownTemplate: true };
}
