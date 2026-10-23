import { describe, it, expect } from 'vitest';
import { assembleNavigation, type NavigationInput } from './assembleNavigation';
import { destinationCatalog } from './catalog';

// Navigation acceptance scenarios (SDD 17.3 "Navigation"): universal items for every role including degraded,
// overflow into More, active state for overflow, unknown and duplicate identifiers, tenant labels.

const base: NavigationInput = {
  viewport: 'desktop',
  layoutDestinations: ['work-orders', 'assets'],
  degradedFields: [],
  catalog: destinationCatalog,
  activeId: 'dashboard',
};
const ids = (r: ReturnType<typeof assembleNavigation>) => r.model.items.map((i) => i.id);

describe('assembleNavigation: persona sets', () => {
  it('technician on tablet and desktop: Dashboard, Work Orders, Assets, Settings (Settings pinned last)', () => {
    for (const viewport of ['tablet', 'desktop'] as const) {
      const r = assembleNavigation({ ...base, viewport });
      expect(r.model.items.map((i) => i.label)).toEqual(['Dashboard', 'Work Orders', 'Assets', 'Settings']);
      expect(r.model.items.at(-1)?.pinned).toBe(true);
    }
  });

  it('technician on mobile: Dashboard, Work Orders, Assets, More', () => {
    const r = assembleNavigation({ ...base, viewport: 'mobile' });
    expect(r.model.items.map((i) => i.label)).toEqual(['Dashboard', 'Work Orders', 'Assets', 'More']);
  });

  it('estimator: Dashboard, Quotes, Field Review, then Settings (desktop) or More (mobile)', () => {
    const layoutDestinations = ['quotes', 'field-review'];
    expect(assembleNavigation({ ...base, layoutDestinations }).model.items.map((i) => i.label)).toEqual(['Dashboard', 'Quotes', 'Field Review', 'Settings']);
    expect(assembleNavigation({ ...base, viewport: 'mobile', layoutDestinations }).model.items.map((i) => i.label)).toEqual(['Dashboard', 'Quotes', 'Field Review', 'More']);
  });

  it('changing the persona registry changes navigation with no code change', () => {
    const a = assembleNavigation({ ...base, layoutDestinations: ['assets'] });
    const b = assembleNavigation({ ...base, layoutDestinations: ['quotes', 'assets', 'work-orders'] });
    expect(ids(a)).toEqual(['dashboard', 'assets', 'settings']);
    expect(ids(b)).toEqual(['dashboard', 'quotes', 'assets', 'work-orders', 'settings']);
  });
});

describe('assembleNavigation: universal destinations are guaranteed', () => {
  it('renders Dashboard with an empty registry entry', () => {
    const r = assembleNavigation({ ...base, layoutDestinations: [] });
    expect(ids(r)).toEqual(['dashboard', 'settings']);
  });

  it('an entry that omits dashboard cannot remove it, and dashboard in the list is not duplicated or trusted', () => {
    const r = assembleNavigation({ ...base, layoutDestinations: ['work-orders'] });
    expect(ids(r)[0]).toBe('dashboard');
    const withBogus = assembleNavigation({ ...base, layoutDestinations: ['dashboard', 'work-orders'] });
    // "dashboard" is not in the catalog (it is shell-owned), so it is treated as unknown and omitted.
    expect(ids(withBogus)).toEqual(['dashboard', 'work-orders', 'settings']);
    expect(withBogus.events.map((e) => e.event)).toContain('nav.unknown_destination');
  });
});

describe('assembleNavigation: mobile overflow', () => {
  const five = ['work-orders', 'assets', 'quotes', 'field-review'];

  it('shows at most five items: Dashboard, three role items, More; the rest overflow into More in order', () => {
    const r = assembleNavigation({ ...base, viewport: 'mobile', layoutDestinations: five });
    expect(ids(r)).toEqual(['dashboard', 'work-orders', 'assets', 'quotes', 'more']);
    expect(r.model.items).toHaveLength(5);
    expect(r.model.overflow.map((o) => o.id)).toEqual(['field-review']);
  });

  it('marks More active when the current destination is an overflow item', () => {
    const r = assembleNavigation({ ...base, viewport: 'mobile', layoutDestinations: five, activeId: 'field-review' });
    expect(r.model.items.find((i) => i.id === 'more')?.active).toBe(true);
    expect(r.model.overflow[0].active).toBe(true);
  });
});

describe('assembleNavigation: active state', () => {
  it('exactly one item is active when on a navigation destination', () => {
    const r = assembleNavigation({ ...base, activeId: 'assets' });
    expect(r.model.items.filter((i) => i.active).map((i) => i.id)).toEqual(['assets']);
  });

  it('no item is active on a screen outside the navigation set, and the nearest parent is never highlighted', () => {
    const r = assembleNavigation({ ...base, activeId: null });
    expect(r.model.items.some((i) => i.active)).toBe(false);
  });

  it('matches by identifier, so a tenant label change never changes which item is active', () => {
    const r = assembleNavigation({ ...base, activeId: 'work-orders', tenantLabels: { 'work-orders': 'Jobs' } });
    const item = r.model.items.find((i) => i.id === 'work-orders');
    expect(item?.label).toBe('Jobs');
    expect(item?.active).toBe(true);
  });
});

describe('assembleNavigation: degradation hierarchy', () => {
  it('layout_config degraded at session start: universal items only, one message, logged', () => {
    const r = assembleNavigation({ ...base, degradedFields: ['layout_config'] });
    expect(ids(r)).toEqual(['dashboard', 'settings']);
    expect(r.toast).toMatch(/Dashboard is available/);
    expect(r.events.map((e) => e.event)).toEqual(['nav.layout_degraded']);
  });

  it('layout_config degraded mid-session: keeps the last good set, no message, logged', () => {
    const good = assembleNavigation(base);
    const r = assembleNavigation({ ...base, degradedFields: ['layout_config'], layoutDestinations: [], previousRoleDestinations: good.model.roleDestinations });
    expect(ids(r)).toEqual(ids(good));
    expect(r.toast).toBeUndefined();
  });

  it('unknown destination identifier: omitted, the rest render in order, logged, no message', () => {
    const r = assembleNavigation({ ...base, layoutDestinations: ['work-orders', 'inventory-labs', 'assets'] });
    expect(ids(r)).toEqual(['dashboard', 'work-orders', 'assets', 'settings']);
    expect(r.events.map((e) => e.event)).toEqual(['nav.unknown_destination']);
    expect(r.toast).toBeUndefined();
  });

  it('duplicate identifier: first kept, later suppressed, logged', () => {
    const r = assembleNavigation({ ...base, layoutDestinations: ['assets', 'work-orders', 'assets'] });
    expect(ids(r)).toEqual(['dashboard', 'assets', 'work-orders', 'settings']);
    expect(r.events.map((e) => e.event)).toEqual(['nav.duplicate_destination']);
  });

  it('catalog unavailable: universal items only, logged', () => {
    const r = assembleNavigation({ ...base, catalog: null });
    expect(ids(r)).toEqual(['dashboard', 'settings']);
    expect(r.events.map((e) => e.event)).toEqual(['nav.catalog_unavailable']);
    expect(r.toast).toBeDefined();
  });

  it('invalid destination definition: omitted and logged', () => {
    const broken = { ...destinationCatalog, assets: { ...destinationCatalog.assets, route: '' } };
    const r = assembleNavigation({ ...base, catalog: broken });
    expect(ids(r)).toEqual(['dashboard', 'work-orders', 'settings']);
    expect(r.events.map((e) => e.event)).toEqual(['nav.destination_invalid']);
  });
});

describe('assembleNavigation: unavailable destinations', () => {
  it('flags a supplied-unavailable destination with its reason, without removing it', () => {
    const r = assembleNavigation({ ...base, unavailable: ['assets'] });
    const assets = r.model.items.find((i) => i.id === 'assets');
    expect(assets?.unavailable).toBe(true);
    expect(assets?.unavailableReason).toBeTruthy();
    expect(r.model.items.find((i) => i.id === 'work-orders')?.unavailable).toBeUndefined();
  });
});

describe('assembleNavigation: purity', () => {
  it('does not mutate its inputs and is deterministic', () => {
    const input = { ...base, layoutDestinations: ['work-orders', 'work-orders', 'ghost'] };
    const copy = JSON.stringify(input);
    const a = assembleNavigation(input);
    const b = assembleNavigation(input);
    expect(JSON.stringify(input)).toBe(copy);
    expect(a).toEqual(b);
  });
});
