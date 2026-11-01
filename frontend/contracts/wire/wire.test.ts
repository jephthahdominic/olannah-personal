import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateWireContext, validateWireHistory, validateWireZone } from './validate';
import { dashboardZone, withDashboard, type DashboardVariant } from '../fixtures/dashboard';
import { workOrdersZone, withWorkOrders } from '../fixtures/workOrders';

// Every response the practice API can produce, checked against the delivered contract. The JSON files are the API's own handoff
// examples (backend/context_api/handoff/examples), copied here so the frontend tests do not need the backend checked out.
const FIXTURES = join(__dirname, '..', 'fixtures', 'wire');
const load = (name: string): unknown => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
// A loosely typed, editable copy, so a test can break one field at a time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const ctx = (): Loose => structuredClone(load('context.happy.json'));

describe('context fixtures stay in step with the backend', () => {
  const backend = join(__dirname, '..', '..', '..', 'backend', 'context_api', 'handoff', 'examples');
  it.skipIf(!existsSync(backend))('every fixture is byte-identical to the API handoff example', () => {
    for (const file of readdirSync(FIXTURES)) expect(readFileSync(join(FIXTURES, file), 'utf8'), file).toBe(readFileSync(join(backend, file), 'utf8'));
    expect(readdirSync(FIXTURES).sort()).toEqual(readdirSync(backend).sort());
  });
});

describe('validateWireContext: every scenario in the guide', () => {
  it.each([
    'context.happy.json',
    'context.sitedocs-down.json',
    'context.sitedocs-and-xoi-down.json',
    'context.portal-login-wall.json',
    'context.sampro-down.json',
    'context.unmapped-role.json',
    'context.clear.json',
    'context.busy.json',
    'context.busy-xoi-down.json',
    'context.no-active-job.json',
    'context.over-budget.json',
  ])('%s is a valid context with every zone intact', (file) => {
    const result = validateWireContext(load(file));
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.malformedZones).toEqual([]);
    for (const outcome of Object.values(result.context.zones)) expect(outcome.ok).toBe(true);
  });

  it('an unrecognized schema version is a mismatch, whatever else is in the payload (SR20)', () => {
    expect(validateWireContext(load('context.bad-schema.json'))).toEqual({ kind: 'schema_mismatch', version: '9.9' });
    // Even a payload that would otherwise be broken: the version decides first.
    expect(validateWireContext({ schema_version: '2.0', anything: 1 })).toEqual({ kind: 'schema_mismatch', version: '2.0' });
  });

  it('a malformed zone degrades that zone only, and says which (SR21A)', () => {
    const result = validateWireContext(load('context.malformed-zone.json'));
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.malformedZones).toEqual(['alerts']);
    expect(result.context.zones.alerts.ok).toBe(false);
    expect(result.context.zones.work_order.ok).toBe(true);
    expect(result.context.zones.steps.ok).toBe(true);
    expect(result.context.zones.actions.ok).toBe(true);
    expect(result.context.zones.history.ok).toBe(true);
  });

  it('a broken envelope is a whole-workspace failure (SR21B)', () => {
    expect(validateWireContext(load('context.malformed-envelope.json'))).toEqual({ kind: 'envelope_malformed' });
  });

  it.each([[null], [undefined], ['text'], [42], [[]], [{}], [{ schema_version: '' }], [{ schema_version: 1 }]])('never throws on %j', (junk) => {
    expect(() => validateWireContext(junk)).not.toThrow();
    expect(validateWireContext(junk).kind).toMatch(/envelope_malformed|schema_mismatch/);
  });

  it('a missing or mistyped envelope field is an envelope failure, never silently defaulted', () => {
    for (const field of ['session_id', 'delivered_at', 'resolved_role', 'worker', 'layout_config', 'active_work_order', 'connection_status', 'degraded_fields', 'zones']) {
      const broken = ctx();
      delete broken[field];
      expect(validateWireContext(broken).kind, `missing ${field}`).toBe('envelope_malformed');
    }
    const wrongType = ctx();
    wrongType.layout_config.destinations = 'jobs';
    expect(validateWireContext(wrongType).kind).toBe('envelope_malformed');
  });

  it('a zone with state "stale" is malformed: the API never sends it (the canvas owns staleness)', () => {
    const c = ctx();
    c.zones.steps.state = 'stale';
    const result = validateWireContext(c);
    expect(result.kind === 'ok' && result.malformedZones).toEqual(['steps']);
  });

  it('a missing zone is malformed, never assumed empty', () => {
    const c = ctx();
    delete c.zones.actions;
    const result = validateWireContext(c);
    expect(result.kind === 'ok' && result.malformedZones).toEqual(['actions']);
  });

  it('several bad zones are each reported, and the good ones are untouched', () => {
    const c = ctx();
    c.zones.alerts.data = 'x';
    c.zones.steps.data[0].kind = 'nonsense';
    const result = validateWireContext(c);
    expect(result.kind === 'ok' && result.malformedZones).toEqual(['alerts', 'steps']);
  });

  it('a record with a wrong-typed field fails its whole zone, not just the record', () => {
    const c = ctx();
    c.zones.actions.data[0].enabled = 'yes';
    const result = validateWireContext(c);
    expect(result.kind === 'ok' && result.malformedZones).toEqual(['actions']);
  });

  it('an extra field (from a newer producer) is tolerated and left in place', () => {
    const c = ctx();
    c.extra = { a: 1 };
    c.zones.alerts.extra = true;
    const result = validateWireContext(c);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect((result.context as Loose).extra).toEqual({ a: 1 });
  });

  it('an unknown zone id is ignored, not an error (the zone model is owned by BRD 1.2)', () => {
    const c = ctx();
    c.zones.parts = { state: 'rendered', as_of: null, data: [] };
    expect(validateWireContext(c).kind).toBe('ok');
  });

  it('never edits what it receives: a frozen payload validates, and nothing in it changes (SR16C)', () => {
    const raw = load('context.busy.json');
    const before = JSON.stringify(raw);
    const deepFreeze = (o: unknown): void => {
      if (o && typeof o === 'object') {
        Object.freeze(o);
        Object.values(o).forEach(deepFreeze);
      }
    };
    deepFreeze(raw);
    expect(validateWireContext(raw).kind).toBe('ok');
    expect(JSON.stringify(raw)).toBe(before);
  });
});

describe('what the scenarios actually say (read, never inferred)', () => {
  const ok = (file: string) => {
    const r = validateWireContext(load(file));
    if (r.kind !== 'ok') throw new Error('expected ok');
    return r.context;
  };

  it('the unmapped role is a flag the PCR raised, not something deduced', () => {
    expect(ok('context.unmapped-role.json').degraded_fields).toContainEqual({ field: 'layout', reason: 'unmapped_role' });
    expect(ok('context.happy.json').degraded_fields).toEqual([]);
  });

  it('a context with no layout flag but an unfamiliar template is NOT an unmapped role', () => {
    const c = ctx();
    c.layout_config.template_id = 'something.new';
    const r = validateWireContext(c);
    expect(r.kind === 'ok' && r.context.degraded_fields).toEqual([]);
  });

  it('no active job: no work order header, an empty work order zone, and nothing to load for history', () => {
    const c = ok('context.no-active-job.json');
    expect(c.active_work_order).toBeNull();
    const wo = c.zones.work_order;
    expect(wo.ok && wo.zone.data).toBeNull();
    const h = c.zones.history;
    expect(h.ok && h.zone.pointer).toBeNull();
  });

  it('a source system down makes only its zones unavailable, with no data', () => {
    const c = ok('context.sitedocs-and-xoi-down.json');
    expect(c.zones.steps.ok && c.zones.steps.zone.state).toBe('unavailable');
    expect(c.zones.steps.ok && c.zones.steps.zone.data).toEqual([]);
    expect(c.zones.alerts.ok && c.zones.alerts.zone.state).toBe('rendered');
    expect(c.degraded_fields.map((d) => d.field).sort()).toEqual(['source.sitedocs', 'source.xoi']);
  });

  it('over budget still arrives as a normal context, carrying the delivery flag', () => {
    const c = ok('context.over-budget.json');
    expect(c.degraded_fields).toContainEqual({ field: 'delivery', reason: 'budget_exceeded' });
    expect(Object.values(c.zones).every((z) => z.ok)).toBe(true);
  });

  it('an empty healthy job is rendered-and-empty, which is an empty state and not an error', () => {
    const c = ok('context.clear.json');
    const alerts = c.zones.alerts;
    expect(alerts.ok && alerts.zone.state).toBe('rendered');
    expect(alerts.ok && alerts.zone.data).toEqual([]);
    expect(c.degraded_fields).toEqual([]);
  });

  it('the busy job carries every step status, so "done" is a state the stepper must handle', () => {
    const steps = ok('context.busy.json').zones.steps;
    const statuses = new Set(steps.ok ? steps.zone.data.map((s) => s.status) : []);
    expect(statuses).toEqual(new Set(['done', 'current', 'todo']));
  });

  it('history arrives as loading with an opaque pointer, which is handed on and never built', () => {
    const h = ok('context.happy.json').zones.history;
    expect(h.ok && h.zone).toEqual({ state: 'loading', pointer: 'hist_s_8f2_E-2231' });
  });

  it('the work order is as_of earlier than delivery: both are carried so the age can be SHOWN, never judged', () => {
    const c = ok('context.happy.json');
    const wo = c.zones.work_order;
    expect(wo.ok && wo.zone.as_of).toBe('2026-10-22T16:40:00-05:00');
    expect(c.delivered_at).toBe('2026-10-23T08:00:03-05:00');
  });
});

describe('validateWireHistory', () => {
  it.each([
    ['history.happy.json', 5],
    ['history.busy.json', 28],
    ['history.clear.json', 0],
    ['history.drive-down.json', 4],
  ])('%s is valid with %i records', (file, count) => {
    const r = validateWireHistory(load(file));
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.message.data).toHaveLength(count);
  });

  it('empty history is rendered and empty, not an error', () => {
    const r = validateWireHistory(load('history.clear.json'));
    expect(r.kind === 'ok' && r.message.state).toBe('rendered');
  });

  it('a partial history says which source was missing, for display', () => {
    const r = validateWireHistory(load('history.drive-down.json'));
    expect(r.kind === 'ok' && r.message.data_quality.unavailable_sources).toEqual(['shared_drive']);
  });

  it('a malformed history payload degrades the history zone only', () => {
    expect(validateWireHistory(load('history.malformed-zone.json'))).toEqual({ kind: 'malformed' });
  });

  it.each([[null], ['x'], [{}], [{ type: 'zone_data' }]])('never throws on %j', (junk) => {
    expect(validateWireHistory(junk)).toEqual({ kind: 'malformed' });
  });

  it('record dates are site-local YYYY-MM-DD strings and a datetime or other shape is rejected', () => {
    const m: Loose = structuredClone(load('history.happy.json'));
    m.data[0].date = '2026-10-22T16:40:00-05:00';
    expect(validateWireHistory(m)).toEqual({ kind: 'malformed' });
  });
});

// The PROPOSED dashboard zone (approved design 03). Optional until the backend delivers it.
describe('the proposed dashboard zone', () => {
  const VARIANTS: DashboardVariant[] = ['ready', 'insight', 'client-update', 'no-jobs'];

  it('is absent from every response the practice API sends today, and that is not an error', () => {
    for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('context.') && !f.includes('malformed') && !f.includes('bad-schema'))) {
      const result = validateWireContext(load(file));
      expect(result.kind, file).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.context.zones.dashboard, file).toBeUndefined();
        expect(result.malformedZones, file).toEqual([]);
      }
    }
  });

  it.each(VARIANTS)('a delivered "%s" dashboard passes validation, and nothing else about the context changes', (variant) => {
    const raw = withDashboard(ctx(), variant);
    const result = validateWireContext(raw);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.malformedZones).toEqual([]);
    expect(result.context.zones.dashboard?.ok).toBe(true);
    expect(result.context.zones.alerts.ok).toBe(true);
  });

  it('a malformed dashboard degrades that zone only and names it', () => {
    const raw = withDashboard(ctx());
    (raw.zones.dashboard as { data: { counts: unknown } }).data.counts = 'many';
    const result = validateWireContext(raw);
    expect(result.kind === 'ok' && result.malformedZones).toEqual(['dashboard']);
    expect(result.kind === 'ok' && result.context.zones.steps.ok).toBe(true);
  });

  it.each([
    ['a time that is not HH:MM', (d: Loose) => (d.next_job.time_local = '8am')],
    ['a count with no label', (d: Loose) => delete d.counts[0].label],
    ['a count shape that is not warning or error', (d: Loose) => (d.counts[0].status = 'info')],
    ['a status tone it does not know', (d: Loose) => (d.today.items[0].status.tone = 'purple')],
    ['no greeting', (d: Loose) => delete d.greeting],
  ])('rejects %s', (_name, damage) => {
    const zone = dashboardZone();
    damage(zone.data);
    expect(validateWireZone('dashboard', zone).ok).toBe(false);
  });

  it('leaves the insight for WidgetContainer to judge: a bad insight does not fail the dashboard', () => {
    const zone = dashboardZone('insight');
    (zone.data.next_job as { insight: unknown }).insight = { type: 'hologram', schemaVersion: '9.9' };
    expect(validateWireZone('dashboard', zone).ok).toBe(true);
  });

  it('accepts supplied em dashes for counts that are not known, and shows them as given', () => {
    const zone = dashboardZone();
    zone.data = { ...zone.data, counts: zone.data.counts.map((c) => ({ ...c, value: '—', status: null })) };
    expect(validateWireZone('dashboard', zone).ok).toBe(true);
  });

  it('the no-jobs dashboard still has its counts: empty is a state, not an error', () => {
    const zone = dashboardZone('no-jobs');
    expect(zone.data.next_job).toBeNull();
    expect(zone.data.counts.map((c) => c.value)).toEqual([0, 0, 0]);
    expect(validateWireZone('dashboard', zone).ok).toBe(true);
  });
});

// The PROPOSED work orders zone (approved design 04). Optional until the backend delivers it.
describe('the proposed work orders zone', () => {
  it('passes validation in every situation, and changes nothing else about the context', () => {
    for (const [variant, expanded] of [['assigned', false], ['assigned', true], ['empty', false]] as const) {
      expect(validateWireZone('work_orders', workOrdersZone(variant, expanded)).ok, `${variant} ${expanded}`).toBe(true);
    }
    const result = validateWireContext(withWorkOrders(ctx()));
    expect(result.kind === 'ok' && result.malformedZones).toEqual([]);
    expect(result.kind === 'ok' && result.context.zones.work_orders?.ok).toBe(true);
  });

  it('is absent from every response the practice API sends today, and that is not an error', () => {
    const result = validateWireContext(ctx());
    expect(result.kind === 'ok' && result.context.zones.work_orders).toBeUndefined();
  });

  it('a malformed one degrades that zone only', () => {
    const raw = withWorkOrders(ctx());
    (raw.zones.work_orders as { data: unknown }).data = { heading: 'Work orders', groups: 'none' };
    const result = validateWireContext(raw);
    expect(result.kind === 'ok' && result.malformedZones).toEqual(['work_orders']);
    expect(result.kind === 'ok' && result.context.zones.steps.ok).toBe(true);
  });

  it.each([
    ['a row with no task', (d: Loose) => delete d.groups[0].items[0].task],
    ['a time that is not HH:MM', (d: Loose) => (d.groups[0].items[0].time_local = '10.30')],
    ['a "more" with no button label', (d: Loose) => delete d.groups[1].more.action_label],
    ['no page heading', (d: Loose) => delete d.heading],
  ])('rejects %s', (_name, damage) => {
    const zone = workOrdersZone();
    damage(zone.data);
    expect(validateWireZone('work_orders', zone).ok).toBe(false);
  });

  it('asks for more of one group only: tomorrow has 4 of 11, today is complete', () => {
    const zone = workOrdersZone();
    const [today, tomorrow] = zone.data.groups;
    expect(today.more).toBeNull();
    expect(tomorrow.items).toHaveLength(4);
    expect(tomorrow.more).toEqual({ caption: 'Showing 4 of 11 jobs', action_label: 'Show 7 more jobs' });
    const all = workOrdersZone('assigned', true).data.groups[1];
    expect(all.items).toHaveLength(11);
    expect(all.more).toBeNull();
  });

  it('the first job is the practice API\'s own active work order, so the screens agree', () => {
    expect(workOrdersZone().data.groups[0].items[0].id).toBe('WO-4471');
  });

  it('an empty zone is a valid delivery: no groups is a state, not an error', () => {
    expect(workOrdersZone('empty').data.groups).toEqual([]);
  });
});
