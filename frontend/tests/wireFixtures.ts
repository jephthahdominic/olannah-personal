import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateWireContext, type Wire } from '@/contracts';
import { deepFreeze, type DeepReadonly } from '@/runtime/freeze';

// Test helpers over the practice API's own example responses (contracts/fixtures/wire). Every test that needs a context uses these, so
// the whole suite exercises the DELIVERED shape and nothing else.
export type RawContext = Record<string, unknown> & { zones: Record<string, unknown> };

export const rawFixture = (name: string): RawContext => JSON.parse(readFileSync(join(__dirname, '..', 'contracts', 'fixtures', 'wire', `${name}.json`), 'utf8'));

/** A raw technician context (the practice API's "s_8f2"). A fresh copy every call. */
export const rawTechnician = (): RawContext => rawFixture('context.happy');

/** The estimator as mock mode builds it: the practice API has no estimator, so it is the empty job with the estimator's identity. */
export const rawEstimator = (): RawContext => ({
  ...rawFixture('context.no-active-job'),
  session_id: 's_estimator',
  resolved_role: 'estimator',
  worker: { id: 'E0007', name: 'Kevin Osei', role_label: 'Senior Estimator' },
  layout_config: { template_id: 'estimator.v1', destinations: ['quotes', 'field-review'] },
});

export type TestContext = DeepReadonly<Wire.ValidatedContext>;

/** Validates, then deep-freezes, exactly as the boot machine does. Throws if the fixture is not a valid delivery. */
export function validated(raw: unknown): TestContext {
  const result = validateWireContext(raw);
  if (result.kind !== 'ok') throw new Error(`fixture is not a valid delivery: ${result.kind}`);
  return deepFreeze(result.context);
}

export const technicianContext = (): TestContext => validated(rawTechnician());
export const estimatorContext = (): TestContext => validated(rawEstimator());
export const unmappedRoleContext = (): TestContext => validated(rawFixture('context.unmapped-role'));
