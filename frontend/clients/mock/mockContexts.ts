import { DeliveryError } from '@/contracts';
import { withDashboard } from '@/contracts/fixtures/dashboard';
import { withWorkOrders } from '@/contracts/fixtures/workOrders';
import type { MockDashboard, MockPersona, MockScenario, MockWorkOrders } from './mockIdp';

// Mock deliveries are the PRACTICE API's own example responses (contracts/fixtures/wire, copied from the backend handoff), so mock mode
// and practice mode hand the canvas exactly the same shapes, and going live changes nothing in the canvas. They load on demand so the
// fixtures stay out of the main bundle.
type Fixture = Record<string, unknown>;
// An explicit loader per file, so the bundler can see every import (a computed path would not resolve reliably).
const LOADERS = {
  'context.happy': () => import('@/contracts/fixtures/wire/context.happy.json'),
  'context.clear': () => import('@/contracts/fixtures/wire/context.clear.json'),
  'context.busy': () => import('@/contracts/fixtures/wire/context.busy.json'),
  'context.no-active-job': () => import('@/contracts/fixtures/wire/context.no-active-job.json'),
  'context.sitedocs-down': () => import('@/contracts/fixtures/wire/context.sitedocs-down.json'),
  'context.sitedocs-and-xoi-down': () => import('@/contracts/fixtures/wire/context.sitedocs-and-xoi-down.json'),
  'context.sampro-down': () => import('@/contracts/fixtures/wire/context.sampro-down.json'),
  'context.portal-login-wall': () => import('@/contracts/fixtures/wire/context.portal-login-wall.json'),
  'context.over-budget': () => import('@/contracts/fixtures/wire/context.over-budget.json'),
  'context.unmapped-role': () => import('@/contracts/fixtures/wire/context.unmapped-role.json'),
  'context.bad-schema': () => import('@/contracts/fixtures/wire/context.bad-schema.json'),
  'context.malformed-envelope': () => import('@/contracts/fixtures/wire/context.malformed-envelope.json'),
  'context.malformed-zone': () => import('@/contracts/fixtures/wire/context.malformed-zone.json'),
  'history.happy': () => import('@/contracts/fixtures/wire/history.happy.json'),
  'history.clear': () => import('@/contracts/fixtures/wire/history.clear.json'),
  'history.busy': () => import('@/contracts/fixtures/wire/history.busy.json'),
  'history.malformed-zone': () => import('@/contracts/fixtures/wire/history.malformed-zone.json'),
  'history.drive-down': () => import('@/contracts/fixtures/wire/history.drive-down.json'),
} satisfies Record<string, () => Promise<{ default: unknown }>>;
type FixtureName = keyof typeof LOADERS;
const load = async (file: FixtureName): Promise<Fixture> => (await LOADERS[file]()).default as Fixture;

const SCENARIO_FILES: Record<MockScenario, FixtureName> = {
  normal: 'context.happy',
  clear: 'context.clear',
  busy: 'context.busy',
  'no-job': 'context.no-active-job',
  'sitedocs-down': 'context.sitedocs-down',
  'sitedocs-and-xoi-down': 'context.sitedocs-and-xoi-down',
  'sampro-down': 'context.sampro-down',
  'portal-login-wall': 'context.portal-login-wall',
  'over-budget': 'context.over-budget',
};

/**
 * The raw context for a mock persona. Always a fresh object, like a network payload. The practice API serves only the technician, so
 * the estimator is built from its "no active job" context with the estimator's identity and layout, until the API defines one.
 */
export async function mockContextFor(persona: MockPersona, scenario: MockScenario, dashboard: MockDashboard = 'ready', workOrders: MockWorkOrders = 'assigned'): Promise<unknown> {
  switch (persona) {
    case 'technician':
    case 'multirole': {
      // Holds several roles: the PRIMARY one (technician) decides the layout, never a hybrid. The practice API sends no dashboard zone yet, so
      // the Dashboard (approved design 03) is attached here, and `absent` shows what the practice API delivers today.
      const context = structuredClone(await load(SCENARIO_FILES[scenario])) as { zones: Record<string, unknown> };
      const withDash = dashboard === 'absent' ? context : withDashboard(context, dashboard);
      return workOrders === 'absent' ? withDash : withWorkOrders(withDash, workOrders);
    }
    case 'estimator': {
      const base = structuredClone(await load('context.no-active-job'));
      return {
        ...base,
        session_id: 's_estimator',
        resolved_role: 'estimator',
        worker: { id: 'E0007', name: 'Kevin Osei', role_label: 'Senior Estimator' },
        layout_config: { template_id: 'estimator.v1', destinations: ['quotes', 'field-review'] },
      };
    }
    case 'unmapped':
      return structuredClone(await load('context.unmapped-role'));
    case 'norole':
      // The role cannot be determined at all: the delivery answers 404, there is no context object (BRD UR3D).
      throw new DeliveryError('role_undetermined');
  }
}

export const badSchemaContext = (): Promise<Fixture> => load('context.bad-schema').then((c) => structuredClone(c));
export const malformedEnvelopeContext = (): Promise<Fixture> => load('context.malformed-envelope').then((c) => structuredClone(c));
export const malformedZoneContext = (): Promise<Fixture> => load('context.malformed-zone').then((c) => structuredClone(c));
export const mockHistoryFor = async (pointer: string): Promise<Fixture> => {
  const file: FixtureName = pointer.includes('clear') ? 'history.clear' : pointer.includes('busy') ? 'history.busy' : 'history.happy';
  return structuredClone(await load(file));
};
export const malformedHistory = (): Promise<Fixture> => load('history.malformed-zone').then((c) => structuredClone(c));
export const partialHistory = (): Promise<Fixture> => load('history.drive-down').then((c) => structuredClone(c));
export const emptyHistory = (): Promise<Fixture> => load('history.clear').then((c) => structuredClone(c));
