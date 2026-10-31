// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ZoneHost } from './ZoneHost';
import { TEMPLATES } from './templates';
import { componentRegistry } from './registry';
import { ShellContext } from './ShellContext';
import { ZoneStore } from '@/runtime/zones/zoneStore';
import type { ZoneSpec } from './types';
import { makeRuntime } from '@/tests/shellFixtures';
import { messages } from '../messages';

const spec = (id: string, over: Partial<ZoneSpec> = {}): ZoneSpec => ({
  id,
  title: `Zone ${id}`,
  role: 'primary',
  surface: 'card',
  content: ['Probe'],
  unavailable: { title: 'Section unavailable', body: 'We could not load this section.', retry: true },
  empty: { title: 'Nothing here', body: 'Appears once work is assigned.' },
  ...over,
});

// A store holding the given zones in the given conditions. Tests of the zone HOST need a zone in a condition, not a delivery.
type Seed = 'scaffolded' | 'rendered' | 'empty' | 'unavailable';
function setup(seed: Record<string, Seed>) {
  const store = new ZoneStore();
  for (const [key, condition] of Object.entries(seed)) store.set(key, { condition, refreshing: false, refreshDelayed: false, version: 0, asOf: null });
  return store;
}
const worker = { id: 'T1', name: 'A B', role_label: 'T' };

afterEach(() => vi.restoreAllMocks());

describe('templates are data and every zone is shippable', () => {
  it.each(Object.entries(TEMPLATES))('template "%s": every zone registers an unavailable state and an empty explanation', (_id, template) => {
    for (const zone of template.zones) {
      expect(zone.title).toBeTruthy();
      expect(zone.unavailable.title).toBeTruthy();
      expect(zone.unavailable.body).toBeTruthy();
      expect(zone.empty.title).toBeTruthy();
      expect(zone.empty.body).toBeTruthy();
    }
  });

  it.each(Object.entries(TEMPLATES))('template "%s": every content reference resolves in the component registry', (_id, template) => {
    for (const zone of template.zones) for (const name of zone.content) expect(componentRegistry[name]).toBeDefined();
  });

  it.each(Object.entries(TEMPLATES))('template "%s": every breakpoint places every zone exactly once', (_id, template) => {
    for (const placements of Object.values(template.placements)) {
      expect(placements.map((p) => p.zoneId).sort()).toEqual(template.zones.map((z) => z.id).sort());
    }
  });

  it('the delivered zones are the technician template\'s zones, and each zone\'s id is the id the context object gives it', () => {
    expect(TEMPLATES.technician.zones.map((z) => z.id)).toEqual(['alerts', 'work_order', 'steps', 'actions', 'history']);
  });

  it('the job (alerts, steps, actions) is always the main column', () => {
    for (const placements of Object.values(TEMPLATES.technician.placements)) {
      for (const id of ['alerts', 'steps', 'actions']) expect(placements.find((p) => p.zoneId === id)?.region, id).toBe('main');
    }
  });

  it('the supporting zones sit beside the job from tablet up, and on a phone the work order follows it and history folds away', () => {
    const t = TEMPLATES.technician;
    expect(t.placements.mobile.find((p) => p.zoneId === 'work_order')?.region).toBe('main');
    expect(t.placements.mobile.find((p) => p.zoneId === 'history')?.region).toBe('collapsible');
    for (const viewport of ['tablet', 'desktop'] as const) {
      expect(t.placements[viewport].find((p) => p.zoneId === 'work_order')?.region).toBe('aside');
      expect(t.placements[viewport].find((p) => p.zoneId === 'history')?.region).toBe('aside');
    }
  });

  it('alerts, steps and actions have no container of their own (their items are the cards), and the supporting zones sit on a panel', () => {
    const surface = Object.fromEntries(TEMPLATES.technician.zones.map((z) => [z.id, z.surface]));
    expect(surface).toEqual({ alerts: 'workspace', steps: 'workspace', actions: 'workspace', work_order: 'panel', history: 'panel' });
  });

  it('every zone has its OWN unavailable message, not a shared one (BRD UR5A)', () => {
    const titles = TEMPLATES.technician.zones.map((z) => z.unavailable.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('the Dashboard has its own unavailable and empty text, no container of its own, and carries its own heading and indicators', () => {
    const d = TEMPLATES.technician.dashboard!;
    expect(d.id).toBe('dashboard');
    expect(d.unavailable.title).toBeTruthy();
    expect(d.unavailable.title).not.toBe(TEMPLATES.technician.zones.find((z) => z.id === 'alerts')!.unavailable.title);
    expect(d.surface).toBe('workspace');
    expect(d.showTitle).toBe(false);
    expect(d.selfIndicates).toBe(true);
    expect(componentRegistry[d.content[0]]).toBeDefined();
  });

  it('Work Orders has its own unavailable and empty text, no container of its own, and carries its own heading', () => {
    const w = TEMPLATES.technician.workOrders!;
    expect(w.id).toBe('work_orders');
    expect(w.unavailable.title).toBeTruthy();
    expect(w.unavailable.title).not.toBe(TEMPLATES.technician.dashboard!.unavailable.title);
    expect(w.surface).toBe('workspace');
    expect(w.showTitle).toBe(false);
    expect(componentRegistry[w.content[0]]).toBeDefined();
  });

  it('the steps zone is the one that can host a persistence-capable component', () => {
    expect(TEMPLATES.technician.zones.filter((z) => z.persistence === 'persistence-capable-host').map((z) => z.id)).toEqual(['steps']);
  });

  it('technician and estimator are different templates from the same shell code', () => {
    expect(TEMPLATES.technician.id).not.toBe(TEMPLATES.estimator.id);
  });
});

describe('ZoneHost states', () => {
  it('shows a skeleton while the zone waits for its data, hidden from assistive technology', () => {
    const { container } = render(<ZoneHost spec={spec('z')} store={setup({ z: 'scaffolded' })} onRetry={() => {}} />);
    expect(container.querySelector('[data-condition="scaffolded"]')).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows an empty state that explains why, and does not use an error or warning treatment', () => {
    render(<ZoneHost spec={spec('z')} store={setup({ z: 'empty' })} onRetry={() => {}} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Appears once work is assigned.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the zone unavailable state with a retry, using the zone\'s own registered text', () => {
    const onRetry = vi.fn();
    render(<ZoneHost spec={spec('z')} store={setup({ z: 'unavailable' })} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Section unavailable');
    expect(screen.getByText('We could not load this section.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: messages.zone.retry }));
    expect(onRetry).toHaveBeenCalledWith('z');
  });

  it('says plainly that no retry is possible when none is (no dead button)', () => {
    render(<ZoneHost spec={spec('z', { unavailable: { title: 'Gone', body: 'No retry is possible.', retry: false } })} store={setup({ z: 'unavailable' })} onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: messages.zone.retry })).toBeNull();
    expect(screen.getByText('No retry is possible.')).toBeInTheDocument();
  });

  it('renders the zone content when the zone has data', () => {
    function Probe() {
      return <p>probe content</p>;
    }
    componentRegistry_set('Probe', Probe);
    render(
      <ShellContext.Provider value={{ layoutId: 'technician', viewport: 'desktop', worker, activeLabel: 'Work Orders', signOut: () => {}, runtime: makeRuntime().runtime, navigate: () => {}, openWorkOrder: () => {} }}>
        <ZoneHost spec={spec('z')} store={setup({ z: 'rendered' })} onRetry={() => {}} />
      </ShellContext.Provider>,
    );
    expect(screen.getByText('probe content')).toBeInTheDocument();
  });
});

describe('zone isolation (BRD 1.0 UR4C: a problem in one section does not affect the others)', () => {
  it('a throw inside one zone shows ITS unavailable state and leaves the other zone working', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom(): never {
      throw new Error('zone render failed');
    }
    function Fine() {
      return <p>other zone content</p>;
    }
    componentRegistry_set('Boom', Boom);
    componentRegistry_set('Fine', Fine);
    const store = setup({ bad: 'rendered', good: 'rendered' });
    render(
      <ShellContext.Provider value={{ layoutId: 'technician', viewport: 'desktop', worker, activeLabel: null, signOut: () => {}, runtime: makeRuntime().runtime, navigate: () => {}, openWorkOrder: () => {} }}>
        <ZoneHost spec={spec('bad', { content: ['Boom'] })} store={store} onRetry={() => {}} />
        <ZoneHost spec={spec('good', { content: ['Fine'] })} store={store} onRetry={() => {}} />
      </ShellContext.Provider>,
    );
    expect(screen.getByText('Section unavailable')).toBeInTheDocument();
    expect(screen.getByText('other zone content')).toBeInTheDocument();
    expect(store.get('bad').condition).toBe('unavailable');
    expect(store.get('good').condition).toBe('rendered');
  });

  it('updating one zone re-renders only that zone', () => {
    const renders = { a: 0, b: 0 };
    function A() {
      renders.a++;
      return <p>a</p>;
    }
    function B() {
      renders.b++;
      return <p>b</p>;
    }
    componentRegistry_set('A', A);
    componentRegistry_set('B', B);
    const store = setup({ a: 'rendered', b: 'rendered' });
    render(
      <ShellContext.Provider value={{ layoutId: 'technician', viewport: 'desktop', worker, activeLabel: null, signOut: () => {}, runtime: makeRuntime().runtime, navigate: () => {}, openWorkOrder: () => {} }}>
        <ZoneHost spec={spec('a', { content: ['A'] })} store={store} onRetry={() => {}} />
        <ZoneHost spec={spec('b', { content: ['B'] })} store={store} onRetry={() => {}} />
      </ShellContext.Provider>,
    );
    const before = { ...renders };
    act(() => store.set('a', { condition: 'rendered', refreshing: true, refreshDelayed: false, version: 1, asOf: null }));
    expect(renders.a).toBeGreaterThan(before.a);
    expect(renders.b).toBe(before.b);
  });
});

// Test helper: the registry is a frozen-looking record, so tests extend it directly.
function componentRegistry_set(name: string, component: (typeof componentRegistry)[string]) {
  (componentRegistry as Record<string, (typeof componentRegistry)[string]>)[name] = component;
}
