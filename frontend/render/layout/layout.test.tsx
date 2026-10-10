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
  role: 'primary',
  surface: 'card',
  content: ['Probe'],
  unavailable: { title: 'Section unavailable', body: 'We could not load this section.', retry: true },
  empty: { title: 'Nothing here', body: 'Appears once work is assigned.' },
  ...over,
});

function setup(raw: Record<string, unknown>, ids: string[] = ['z']) {
  const store = new ZoneStore();
  store.initialize(ids, raw);
  return store;
}

afterEach(() => vi.restoreAllMocks());

describe('templates are data and every zone is shippable', () => {
  it.each(Object.entries(TEMPLATES))('template "%s": every zone registers an unavailable state and an empty explanation', (_id, template) => {
    for (const zone of template.zones) {
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

  it('the context zone collapses on mobile and is a side rail otherwise; primary is always main', () => {
    const t = TEMPLATES.technician;
    expect(t.placements.mobile.find((p) => p.zoneId === 'context')?.region).toBe('collapsible');
    expect(t.placements.tablet.find((p) => p.zoneId === 'context')?.region).toBe('aside');
    expect(t.placements.desktop.find((p) => p.zoneId === 'context')?.region).toBe('aside');
    for (const placements of Object.values(t.placements)) expect(placements.find((p) => p.zoneId === 'primary')?.region).toBe('main');
  });

  it('technician and estimator are different templates from the same shell code', () => {
    expect(TEMPLATES.technician.id).not.toBe(TEMPLATES.estimator.id);
  });
});

describe('ZoneHost states', () => {
  it('shows a skeleton while the zone waits for its data, hidden from assistive technology', () => {
    const { container } = render(<ZoneHost spec={spec('z')} store={setup({})} onRetry={() => {}} />);
    expect(container.querySelector('[data-condition="scaffolded"]')).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows an empty state that explains why, and does not use an error or warning treatment', () => {
    render(<ZoneHost spec={spec('z')} store={setup({ z: { status: 'empty' } })} onRetry={() => {}} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Appears once work is assigned.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the zone unavailable state with a retry for an unavailable payload, using supplied text', () => {
    const onRetry = vi.fn();
    render(<ZoneHost spec={spec('z')} store={setup({ z: { status: 'unavailable', message: 'Service history is temporarily unavailable.' } })} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Section unavailable');
    expect(screen.getByText('Service history is temporarily unavailable.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: messages.zone.retry }));
    expect(onRetry).toHaveBeenCalledWith('z');
  });

  it('says plainly that no retry is possible when none is (no dead button)', () => {
    render(<ZoneHost spec={spec('z', { unavailable: { title: 'Gone', body: 'No retry is possible.', retry: false } })} store={setup({ z: { status: 'unavailable' } })} onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: messages.zone.retry })).toBeNull();
    expect(screen.getByText('No retry is possible.')).toBeInTheDocument();
  });

  it('shows a degraded banner only for a supplied degraded status, and still renders the content', () => {
    function Probe() {
      return <p>probe content</p>;
    }
    componentRegistry_set('Probe', Probe);
    render(
      <ShellContext.Provider value={{ layoutId: 'technician', viewport: 'desktop', worker: { displayName: 'A B', initials: 'AB', jobTitle: 'T' }, activeLabel: 'Work Orders', signOut: () => {}, runtime: makeRuntime().runtime, navigate: () => {} }}>
        <ZoneHost spec={spec('z')} store={setup({ z: { status: 'degraded', message: 'Showing limited information.' } })} onRetry={() => {}} />
      </ShellContext.Provider>,
    );
    expect(screen.getByText('Showing limited information.')).toBeInTheDocument();
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
    const store = setup({ bad: { status: 'ready' }, good: { status: 'ready' } }, ['bad', 'good']);
    render(
      <ShellContext.Provider value={{ layoutId: 'technician', viewport: 'desktop', worker: { displayName: 'A B', initials: 'AB', jobTitle: 'T' }, activeLabel: null, signOut: () => {}, runtime: makeRuntime().runtime, navigate: () => {} }}>
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
    const store = setup({ a: { status: 'ready' }, b: { status: 'ready' } }, ['a', 'b']);
    render(
      <ShellContext.Provider value={{ layoutId: 'technician', viewport: 'desktop', worker: { displayName: 'A B', initials: 'AB', jobTitle: 'T' }, activeLabel: null, signOut: () => {}, runtime: makeRuntime().runtime, navigate: () => {} }}>
        <ZoneHost spec={spec('a', { content: ['A'] })} store={store} onRetry={() => {}} />
        <ZoneHost spec={spec('b', { content: ['B'] })} store={store} onRetry={() => {}} />
      </ShellContext.Provider>,
    );
    const before = { ...renders };
    act(() => store.set('a', { condition: 'rendered', refreshing: true, refreshDelayed: false, version: 1, degraded: false }));
    expect(renders.a).toBeGreaterThan(before.a);
    expect(renders.b).toBe(before.b);
  });
});

// Test helper: the registry is a frozen-looking record, so tests extend it directly.
function componentRegistry_set(name: string, component: (typeof componentRegistry)[string]) {
  (componentRegistry as Record<string, (typeof componentRegistry)[string]>)[name] = component;
}
