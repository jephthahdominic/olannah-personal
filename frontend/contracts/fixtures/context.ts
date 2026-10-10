import type { ContextEnvelope } from '../context';
import { contextPanel, estimatorDashboard, technicianDashboard } from './zones';

// Fixtures per contract: valid, unknown-version, malformed (SDD 8.3). Shared with the mock upstream and tests.

const technicianWorker = { displayName: 'Marcus Bell', initials: 'MB', jobTitle: 'Field technician' };
const estimatorWorker = { displayName: 'Kevin Osei', initials: 'KO', jobTitle: 'Senior estimator' };

const base = {
  schemaVersion: '1.0',
  persona: {},
  toolConnections: [{ toolId: 'work-orders', status: 'connected' as const }],
  historyRef: 'history:site-001',
  degradedFields: [] as string[],
  // Roles with no layout or no determinable role have nothing to show: both zones are honestly empty (explained, never blank).
  zones: { 'primary:dashboard': { status: 'empty' }, context: { status: 'empty' } } as Record<string, unknown>,
};

export const technicianContext: ContextEnvelope = {
  ...base,
  worker: technicianWorker,
  zones: { 'primary:dashboard': { status: 'ready', data: technicianDashboard }, context: { status: 'ready', data: contextPanel } },
  resolvedRole: 'technician',
  layoutConfig: {
    layoutId: 'technician',
    destinations: ['work-orders', 'assets'],
    refreshTriggers: ['status-change', 'work-order-open'],
  },
};

export const estimatorContext: ContextEnvelope = {
  ...base,
  worker: estimatorWorker,
  zones: { 'primary:dashboard': { status: 'ready', data: estimatorDashboard }, context: { status: 'ready', data: contextPanel } },
  resolvedRole: 'estimator',
  layoutConfig: {
    layoutId: 'estimator',
    destinations: ['quotes', 'field-review'],
    refreshTriggers: [],
  },
};

/** Role is known but has no registered layout: the PCR delivers the platform default (BRD 1.0 UR3C). */
export const unmappedRoleContext: ContextEnvelope = {
  ...base,
  worker: technicianWorker,
  resolvedRole: 'dispatcher',
  layoutConfig: { layoutId: 'default', destinations: [], refreshTriggers: [] },
};

/** Role could not be determined at all (BRD 1.0 UR3D). */
export const undeterminedRoleContext: ContextEnvelope = {
  ...base,
  worker: technicianWorker,
  resolvedRole: null,
  layoutConfig: { layoutId: 'default', destinations: [], refreshTriggers: [] },
};

export const unknownVersionContext = { ...technicianContext, schemaVersion: '99.0' };

export const malformedContexts: Record<string, unknown> = {
  notAnObject: 'nope',
  nullPayload: null,
  missingVersion: { resolvedRole: 'technician' },
  missingLayoutConfig: { ...technicianContext, layoutConfig: undefined },
  missingWorkerIdentity: { ...technicianContext, worker: undefined },
  wrongTypes: { ...technicianContext, degradedFields: 'layout_config' },
};
