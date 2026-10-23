// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

const push = vi.fn();
let pathname = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => pathname,
}));

import { Shell } from './Shell';
import { makeRuntime } from '@/tests/shellFixtures';
import { NavigationZone } from '../navigation/NavigationZone';
import { resetNavigationMemory } from '../navigation/navigationMemory';
import { toastStore } from '@/runtime/toasts';
import { liveRegion } from '@/runtime/liveRegion';
import { clearTelemetryBuffer, getBufferedEvents } from '@/runtime/telemetry';
import { technicianContext, estimatorContext, unmappedRoleContext } from '@/contracts/fixtures/context';
import type { ContextEnvelope } from '@/contracts';
import { messages } from '../messages';

const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
const layoutFor = (id: 'technician' | 'estimator' | 'default', unmapped = false) => ({ layoutId: id, unmappedRole: unmapped });
const mount = (context: ContextEnvelope = technicianContext, layout = layoutFor('technician'), signOut = vi.fn()) =>
  render(<Shell context={context} layout={layout} runtime={makeRuntime(context).runtime} signOut={signOut} supportHref="mailto:help@example.test" />);
// A context whose zones are honestly empty, to see the empty-state explanations.
const emptyZones = (c: ContextEnvelope = technicianContext): ContextEnvelope => ({ ...c, zones: { 'primary:dashboard': { status: 'empty' }, context: { status: 'empty' } } });
const navLabels = () => within(screen.getByRole('navigation', { name: messages.nav.primaryLabel })).getAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  push.mockClear();
  pathname = '/';
  resetNavigationMemory();
  toastStore.clear();
  liveRegion.clear();
  clearTelemetryBuffer();
});
afterEach(() => setWidth(1024));

describe('Shell: technician on a phone (375px)', () => {
  beforeEach(() => setWidth(375));

  it('shows the tab bar with Dashboard, Work Orders, Assets and More, and no rail', () => {
    mount();
    expect(navLabels()).toEqual(['Dashboard', 'Work Orders', 'Assets', 'More']);
    expect(document.querySelector('[data-viewport="mobile"]')).not.toBeNull();
  });

  it('has the landmarks: banner topbar, one labelled navigation, main; skip link is the first focusable element', () => {
    mount();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'primary-content');
    const first = document.querySelector<HTMLElement>('a[href], button, [tabindex="0"]');
    expect(first).toHaveAttribute('href', '#primary-content');
    expect(first).toHaveTextContent(messages.nav.skipToContent);
  });

  it('shows the worker supplied by the context object in the topbar, not derived by the UI', () => {
    mount();
    expect(screen.getByRole('img', { name: 'Marcus Bell' })).toHaveTextContent('MB');
    expect(screen.getByRole('banner')).toHaveTextContent(messages.shell.workspaceLabel.technician);
  });

  it('collapses the context zone behind a labelled control, and expands it on request', () => {
    mount();
    const toggle = screen.getByRole('button', { name: messages.zone.showContext });
    const region = document.getElementById('context-zone')!;
    expect(region).toHaveAttribute('hidden');
    fireEvent.click(toggle);
    expect(region).not.toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: messages.zone.hideContext })).toBeInTheDocument();
  });

  it('shows the primary zone explanation instead of a blank zone', () => {
    mount(emptyZones());
    expect(screen.getByText(messages.zone.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.zone.emptyBody)).toBeInTheDocument();
  });

  it('opens the More menu, and Settings from it routes to the Settings destination', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Ask OlannahGet help from the assistant',
      'FeedbackTell us about this screen',
      'SettingsAccount and preferences',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Settings/ }));
    expect(push).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Shell: technician on desktop (1280px)', () => {
  beforeEach(() => setWidth(1280));

  it('shows the rail with Dashboard, Work Orders, Assets and Settings (Settings last), and no tab bar', () => {
    mount();
    expect(navLabels()).toEqual(['Dashboard', 'Work Orders', 'Assets', 'Settings']);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('shows the context zone as a fixed side rail (complementary landmark) with no toggle', () => {
    mount();
    expect(screen.getByRole('complementary', { name: messages.zone.contextTitle })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.zone.showContext })).toBeNull();
  });

  it('puts the navigation before the main content in the DOM, so focus order follows the structure', () => {
    mount();
    const nav = screen.getByRole('navigation');
    const main = screen.getByRole('main');
    expect(nav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows worker name and job title beside the avatar', () => {
    mount();
    expect(screen.getByRole('banner')).toHaveTextContent('Marcus Bell');
    expect(screen.getByRole('banner')).toHaveTextContent('Field technician');
  });
});

describe('Shell: navigation behaviour', () => {
  beforeEach(() => setWidth(1280));

  it('selecting a destination routes to it by identifier', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Work Orders/ }));
    expect(push).toHaveBeenCalledWith('/work-orders');
  });

  it('marks exactly the destination in the URL as active, and nothing on a screen outside the navigation set', () => {
    pathname = '/assets';
    const { unmount } = mount();
    const active = within(screen.getByRole('navigation')).getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(active.map((b) => b.textContent)).toEqual(['Assets']);
    unmount();
    pathname = '/somewhere-else';
    mount();
    expect(within(screen.getByRole('navigation')).getAllByRole('button').some((b) => b.hasAttribute('aria-current'))).toBe(false);
  });

  it('a new session lands on Dashboard, which is active at the root path', () => {
    mount();
    expect(screen.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('an unavailable destination stays visible and focusable, explains itself in a toast, and does not navigate', async () => {
    mount({ ...technicianContext, unavailableDestinations: ['assets'] });
    const assets = screen.getByRole('button', { name: /Assets/ });
    expect(assets).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(assets);
    expect(push).not.toHaveBeenCalled();
    const toastRegion = document.querySelector<HTMLElement>('[data-portal="toast"]')!;
    expect(await within(toastRegion).findByText(messages.nav.unavailableReason)).toBeInTheDocument();
    expect(getBufferedEvents().map((e) => e.event)).toContain('nav.offline_unavailable_selected');
  });

  it('applies a tenant label without changing identifiers or routes', () => {
    mount({ ...technicianContext, tenantLabels: { 'work-orders': 'Jobs' } });
    fireEvent.click(screen.getByRole('button', { name: /Jobs/ }));
    expect(push).toHaveBeenCalledWith('/work-orders');
  });

  it('renders estimator navigation from the same shell code: Dashboard, Quotes, Field Review, Settings', () => {
    mount(estimatorContext, layoutFor('estimator'));
    expect(navLabels()).toEqual(['Dashboard', 'Quotes', 'Field Review', 'Settings']);
    expect(screen.getByRole('banner')).toHaveTextContent(messages.shell.workspaceLabel.estimator);
  });

  it('an unmapped role gets the platform default layout with the destinations it was given', () => {
    mount(unmappedRoleContext, layoutFor('default', true));
    expect(navLabels()).toEqual(['Dashboard', 'Settings']);
    expect(screen.getByRole('banner')).toHaveTextContent(messages.shell.workspaceLabel.default);
  });

  it('omits an unknown destination, renders the rest in order, and logs it without telling the worker', () => {
    mount({ ...technicianContext, layoutConfig: { ...technicianContext.layoutConfig, destinations: ['work-orders', 'inventory-labs', 'assets'] } });
    expect(navLabels()).toEqual(['Dashboard', 'Work Orders', 'Assets', 'Settings']);
    expect(getBufferedEvents().map((e) => e.event)).toContain('nav.unknown_destination');
    expect(screen.queryByText(/inventory-labs/)).toBeNull();
  });

  it('layout_config degraded at session start: universal items only, one plain message, logged', async () => {
    mount({ ...technicianContext, degradedFields: ['layout_config'] });
    expect(navLabels()).toEqual(['Dashboard', 'Settings']);
    expect(await screen.findByText(messages.nav.degradedStart)).toBeInTheDocument();
    expect(getBufferedEvents().map((e) => e.event)).toContain('nav.layout_degraded');
  });

  it('the Settings destination shows the supplied account details and a sign out action', () => {
    pathname = '/settings';
    const signOut = vi.fn();
    mount(technicianContext, layoutFor('technician'), signOut);
    expect(screen.getByText('Marcus Bell', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: messages.workspace.signOut }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe('Shell: zone data drives each zone independently', () => {
  beforeEach(() => setWidth(1280));

  it('a malformed zone payload degrades only that zone; the other zone and the navigation are unaffected', () => {
    mount({ ...technicianContext, zones: { 'primary:dashboard': { status: 'bogus' }, context: { status: 'empty' } } });
    expect(screen.getByText(messages.zone.unavailableTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.zone.contextTitle, { selector: 'p' })).toBeInTheDocument();
    expect(navLabels()).toEqual(['Dashboard', 'Work Orders', 'Assets', 'Settings']);
  });

  it('shows skeletons for zones still waiting on data', () => {
    mount({ ...technicianContext, zones: {} });
    expect(document.querySelectorAll('[data-condition="scaffolded"]').length).toBe(2);
  });
});

describe('NavigationZone failure (BRD 1.0 error row 14)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('swaps only the navigation for a recovery surface with Dashboard and Refresh, and says so once', async () => {
    const onDashboard = vi.fn();
    const broken = [{ id: 'x', label: 'Broken', icon: 'not-a-real-icon' as never }];
    render(
      <>
        <p>workspace keeps working</p>
        <NavigationZone viewport="desktop" items={broken} onSelect={() => {}} menuOpen={false} onDashboard={onDashboard} />
      </>,
    );
    expect(screen.getByText('workspace keeps working')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: messages.nav.primaryLabel });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([messages.nav.recoveryDashboard, messages.nav.recoveryRefresh]);
    expect(getBufferedEvents().map((e) => e.event)).toContain('nav.component_failure');
    fireEvent.click(within(group).getByRole('button', { name: messages.nav.recoveryDashboard }));
    expect(onDashboard).toHaveBeenCalled();
    expect(toastStore.getSnapshot().map((t) => t.message)).toEqual([messages.nav.failed]);
  });
});
