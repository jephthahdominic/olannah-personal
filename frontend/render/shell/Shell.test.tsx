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
import { rawEstimator, rawFixture, rawTechnician, validated, type RawContext } from '@/tests/wireFixtures';
import { withDashboard, type DashboardVariant } from '@/contracts/fixtures/dashboard';
import { withWorkOrders, type WorkOrdersVariant } from '@/contracts/fixtures/workOrders';
import { act } from '@testing-library/react';
import { resolveLayout } from '@/runtime/boot/layoutRegistry';
import { messages } from '../messages';

const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
// The shell is given what the boot machine gives it: the validated, frozen context, and the layout resolved from it.
const mount = (raw: RawContext = rawTechnician(), signOut = vi.fn()) => {
  const context = validated(raw);
  return render(<Shell context={context} layout={resolveLayout(context)} runtime={makeRuntime(raw).runtime} signOut={signOut} supportHref="mailto:help@example.test" />);
};
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

  it('shows the tab bar with Dashboard, the role destinations the PCR delivered, and More, and no rail', () => {
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

  it('has a topbar that is the wordmark and nothing else: no worker, no feedback link, no sync marker (approved design 03)', () => {
    mount();
    const bar = screen.getByRole('banner');
    expect(bar).toHaveTextContent(messages.brand.name);
    expect(within(bar).queryAllByRole('button')).toHaveLength(0);
    expect(within(bar).queryByRole('img', { name: 'Marcus Allen' })).toBeNull();
    expect(bar).not.toHaveTextContent(messages.shell.synced);
  });

  it('collapses the history zone behind a labelled control, and expands it on request', () => {
    mount();
    const toggle = screen.getByRole('button', { name: messages.zone.showContext });
    const region = document.getElementById('context-zone')!;
    expect(region).toHaveAttribute('hidden');
    fireEvent.click(toggle);
    expect(region).not.toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: messages.zone.hideContext })).toBeInTheDocument();
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

  it('has room for the workspace name, the feedback link and the worker, who is named but never given derived initials', () => {
    mount();
    const bar = screen.getByRole('banner');
    expect(bar).toHaveTextContent(messages.shell.workspaceLabel.technician);
    expect(within(bar).getByRole('button', { name: messages.feedback.link })).toBeInTheDocument();
    const avatar = within(bar).getByRole('img', { name: 'Marcus Allen' });
    expect(avatar).not.toHaveTextContent('MA');
  });

  it('shows the history zone as a fixed side rail (complementary landmark) with no toggle', () => {
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
});

describe('Shell: the Context Header (BRD SR26)', () => {
  beforeEach(() => setWidth(1280));
  const header = () => screen.queryByRole('region', { name: messages.contextHeader.label });

  it('shows the work order, site, task, worker and role exactly as delivered, below the topbar and above the content', () => {
    mount();
    const h = header()!;
    expect(h).toHaveTextContent('WO-4471');
    expect(h).toHaveTextContent('Store 118');
    expect(h).toHaveTextContent('Compressor fault - walk-in cooler temp alarm');
    expect(h).toHaveTextContent('Marcus Allen');
    expect(h).toHaveTextContent('Field Technician');
    const banner = screen.getByRole('banner');
    const main = screen.getByRole('main');
    expect(banner.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(h.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is hidden when the context object has no active work order, and nothing else decides that', () => {
    mount(rawFixture('context.no-active-job'));
    expect(header()).toBeNull();
  });

  it('shows on every screen while there is an active work order, including destinations outside the Dashboard', () => {
    pathname = '/jobs';
    mount();
    expect(header()).not.toBeNull();
  });

  it('does not decide visibility from the URL: the Dashboard path with no work order still shows no header', () => {
    pathname = '/';
    mount(rawFixture('context.no-active-job'));
    expect(header()).toBeNull();
  });

  it('has no action controls, links or form fields (it is a read-only region)', () => {
    mount();
    expect(within(header()!).queryAllByRole('button')).toHaveLength(0);
    expect(within(header()!).queryAllByRole('link')).toHaveLength(0);
  });

  it('shows the canvas connectivity as text and a shape, not color alone', () => {
    mount();
    expect(within(header()!).getByText(messages.contextHeader.connectivity.connecting)).toBeInTheDocument();
  });
});

describe('Shell: the delivered zones', () => {
  beforeEach(() => setWidth(1280));

  it('renders every zone from the delivery: alerts, work order, steps, actions and history', () => {
    mount();
    const main = screen.getByRole('main');
    const side = screen.getByRole('complementary');
    // The job is the main column. The work order and the history sit beside it.
    expect(within(main).getByText(/Job Safety Analysis \(JSA\) for Store 118 expired/)).toBeInTheDocument();
    expect(within(main).getByRole('list', { name: messages.zones.steps.ariaLabel })).toBeInTheDocument();
    expect(within(main).getByRole('button', { name: 'Close job' })).toBeInTheDocument();
    expect(within(side).getByText('Northfield Grocers')).toBeInTheDocument();
    // History arrives in a second pass: until then the list shows its own loading state, never a blank.
    expect(within(side).getByLabelText(messages.history.loading)).toBeInTheDocument();
  });

  it('shows alerts in the order delivered, each with its severity as a word', () => {
    mount();
    const alerts = within(screen.getByRole('list', { name: messages.zones.alerts.title })).getAllByRole('listitem');
    expect(alerts).toHaveLength(4);
    expect(alerts[0]).toHaveTextContent(messages.zones.alerts.severity.critical);
    expect(alerts[0]).toHaveTextContent('Job Safety Analysis');
  });

  it('shows how old the work order is, as the wall-clock time delivered, without converting it to another time zone', () => {
    mount();
    expect(screen.getByText('Oct 22, 4:40 PM', { selector: 'time' })).toBeInTheDocument();
  });

  it('renders the action as given: disabled where upstream says it is not enabled, with a manual-step note', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Close job' })).toHaveAttribute('disabled');
    expect(screen.getByText(new RegExp(messages.zones.actions.needsApproval))).toBeInTheDocument();
  });

  it('an action that needs a checkpoint is described, but the canvas shows no approval screen of its own', () => {
    mount();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows each zone\'s own empty explanation when the job has nothing in it: empty is not an error', () => {
    mount(rawFixture('context.clear'));
    expect(screen.getByText(messages.zones.alerts.empty.title + '.')).toBeInTheDocument();
    expect(screen.getByText(messages.zones.steps.empty.title + '.')).toBeInTheDocument();
    expect(screen.queryByText(messages.zones.alerts.unavailable.title)).toBeNull();
  });

  it('with no active job: the work order and history say so, plainly', () => {
    mount(rawFixture('context.no-active-job'));
    expect(screen.getByText(messages.zones.workOrder.empty.title)).toBeInTheDocument();
    expect(screen.getByText(messages.zones.history.empty.title)).toBeInTheDocument();
  });

  it('a source system down makes only its zone unavailable, with that zone\'s own message; the rest keep working', () => {
    mount(rawFixture('context.sitedocs-and-xoi-down'));
    expect(screen.getByText(messages.zones.steps.unavailable.title)).toBeInTheDocument();
    expect(screen.getByText(messages.zones.steps.unavailable.body)).toBeInTheDocument();
    // The alerts that do not depend on those systems are still there.
    expect(screen.getByText(/This equipment has failed twice/)).toBeInTheDocument();
    expect(screen.getByText('Northfield Grocers')).toBeInTheDocument();
    expect(navLabels()).toEqual(['Dashboard', 'Work Orders', 'Assets', 'Settings']);
  });

  it('a malformed zone degrades only that zone; the others and the navigation are unaffected', () => {
    mount(rawFixture('context.malformed-zone'));
    expect(screen.getByText(messages.zones.alerts.unavailable.title)).toBeInTheDocument();
    expect(screen.getByText('Northfield Grocers')).toBeInTheDocument();
    expect(navLabels()).toEqual(['Dashboard', 'Work Orders', 'Assets', 'Settings']);
  });

  it('shows a skeleton for each zone still waiting on its data', () => {
    const raw = rawTechnician();
    for (const id of ['alerts', 'work_order', 'steps', 'actions']) (raw.zones[id] as { state: string }).state = 'loading';
    mount(raw);
    expect(document.querySelectorAll('[data-condition="scaffolded"]').length).toBe(4);
  });

  it('shows the work-in-progress note, not zones, on a destination that has none yet', () => {
    pathname = '/inventory';
    mount();
    expect(screen.getByText(messages.destination.notBuiltTitle)).toBeInTheDocument();
    expect(screen.queryByText(/Job Safety Analysis/)).toBeNull();
  });
});

describe('Shell: navigation behaviour', () => {
  beforeEach(() => setWidth(1280));

  it('selecting a destination routes to it by identifier', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Work Orders/ }));
    expect(push).toHaveBeenCalledWith('/jobs');
  });

  it('marks exactly the destination in the URL as active, and nothing on a screen outside the navigation set', () => {
    pathname = '/inventory';
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

  it('renders estimator navigation from the same shell code: Dashboard, Quotes, Field Review, Settings', () => {
    mount(rawEstimator());
    expect(navLabels()).toEqual(['Dashboard', 'Quotes', 'Field Review', 'Settings']);
    expect(screen.getByRole('banner')).toHaveTextContent(messages.shell.workspaceLabel.estimator);
  });

  it('an unmapped role gets the platform default layout with the destinations it was given', () => {
    mount(rawFixture('context.unmapped-role'));
    expect(navLabels()).toEqual(['Dashboard', 'Settings']);
    expect(screen.getByRole('banner')).toHaveTextContent(messages.shell.workspaceLabel.default);
  });

  it('omits an unknown destination, renders the rest in order, and logs it without telling the worker', () => {
    const raw = rawTechnician();
    (raw.layout_config as { destinations: string[] }).destinations = ['jobs', 'inventory-labs', 'inventory'];
    mount(raw);
    expect(navLabels()).toEqual(['Dashboard', 'Work Orders', 'Assets', 'Settings']);
    expect(getBufferedEvents().map((e) => e.event)).toContain('nav.unknown_destination');
    expect(screen.queryByText(/inventory-labs/)).toBeNull();
  });

  it('layout_config degraded at session start: universal items only, one plain message, logged', async () => {
    const raw = rawTechnician();
    raw.degraded_fields = [{ field: 'layout_config', reason: 'unavailable' }];
    mount(raw);
    expect(navLabels()).toEqual(['Dashboard', 'Settings']);
    expect(await screen.findByText(messages.nav.degradedStart)).toBeInTheDocument();
    expect(getBufferedEvents().map((e) => e.event)).toContain('nav.layout_degraded');
  });

  it('Dashboard stays in the navigation even when the PCR delivers no role destinations at all (SR24)', () => {
    const raw = rawTechnician();
    (raw.layout_config as { destinations: string[] }).destinations = [];
    mount(raw);
    expect(navLabels()).toEqual(['Dashboard', 'Settings']);
  });

  it('the Settings destination shows the supplied account details and a sign out action', () => {
    pathname = '/settings';
    const signOut = vi.fn();
    mount(rawTechnician(), signOut);
    expect(screen.getByText('Marcus Allen', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Field Technician', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: messages.workspace.signOut }));
    expect(signOut).toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------------------------------------------------------------------------
// The Dashboard (approved design 03). The practice API sends no dashboard zone yet, so these contexts carry the PROPOSED one.
// ------------------------------------------------------------------------------------------------------------------------------------
describe('Shell: the Dashboard (approved design 03)', () => {
  beforeEach(() => setWidth(375));
  const mountDash = (variant: DashboardVariant = 'ready') => {
    const raw = withDashboard(rawTechnician(), variant);
    const context = validated(raw);
    const harness = makeRuntime(raw);
    const utils = render(<Shell context={context} layout={resolveLayout(context)} runtime={harness.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    return { ...harness, ...utils };
  };

  it('greets the worker with the SUPPLIED greeting and date, as the page heading', () => {
    mountDash();
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Marcus' })).toBeInTheDocument();
    expect(screen.getByText('Friday, October 23')).toBeInTheDocument();
  });

  it('shows the three supplied counts, with a warning triangle beside Urgent, an error circle beside Late and no shape beside Upcoming', () => {
    const { container } = mountDash();
    const counts = within(screen.getByRole('group', { name: 'Your jobs' }));
    expect(counts.getByText('Urgent').parentElement).toHaveTextContent('1');
    expect(counts.getByText('Late').parentElement).toHaveTextContent('1');
    expect(counts.getByText('Upcoming').parentElement).toHaveTextContent('2');
    const tiles = [...container.querySelectorAll('[class*="tile"]')];
    expect(tiles.map((t) => t.querySelector('svg') !== null)).toEqual([true, true, false]);
    expect(tiles[0].querySelector('svg path[d^="M12 2.5"]')).not.toBeNull(); // the triangle
    expect(tiles[1].querySelector('svg circle')).not.toBeNull(); // the circle
  });

  it('shows the next job: eyebrow, reference and site-local time, status, title, subtitle, location and one outcome-named button', () => {
    mountDash();
    const card = screen.getByText('WO-4471 · 8:00 AM').closest('div[class*="jobFrame"]') as HTMLElement;
    expect(within(card).getByText('Next job')).toBeInTheDocument();
    expect(within(card).getByText('Urgent')).toBeInTheDocument();
    expect(within(card).getByText('Northfield Grocers, Store 118')).toBeInTheDocument();
    expect(within(card).getByText('Compressor fault - walk-in cooler temp alarm')).toBeInTheDocument();
    expect(within(card).getByText('Receiving dock')).toBeInTheDocument();
    // The next job IS the active work order, so it opens the work order hub.
    fireEvent.click(within(card).getByRole('button', { name: 'Open work order' }));
    expect(push).toHaveBeenCalledWith('/work-order');
  });

  it('shows Today and Tomorrow as supplied: headings, list titles, supplied stop counts, times formatted as site-local, and a Late status', () => {
    mountDash();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeInTheDocument();
    const today = within(screen.getByRole('region', { name: 'Today' }));
    expect(today.getByText('Later today')).toBeInTheDocument();
    expect(today.getByText('2 stops')).toBeInTheDocument();
    expect(today.getByText('1:15 PM')).toBeInTheDocument();
    expect(today.getByText('Union Coffee Roasters')).toBeInTheDocument();
    expect(today.getByText('Late')).toBeInTheDocument();
    const tomorrow = within(screen.getByRole('region', { name: 'Tomorrow' }));
    expect(tomorrow.getByText('Scheduled')).toBeInTheDocument();
    expect(tomorrow.getByText('8:00 AM')).toBeInTheDocument();
  });

  it('has no Context Header on the Dashboard (the design shows none), and no job workspace: that is the Work Orders screen', () => {
    mountDash();
    expect(screen.queryByRole('region', { name: messages.contextHeader.label })).toBeNull();
    expect(screen.queryByText(messages.zones.alerts.title)).toBeNull();
    expect(screen.queryByText(messages.zones.steps.title)).toBeNull();
  });

  it('shows the job workspace and the Context Header on the Work Orders screen', () => {
    pathname = '/jobs';
    mountDash();
    expect(screen.getByRole('region', { name: messages.contextHeader.label })).toBeInTheDocument();
    expect(screen.getByText(messages.zones.alerts.title)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Work Orders' })).toBeInTheDocument();
  });

  it('marks Dashboard as the active destination, not Work Orders', () => {
    mountDash();
    const active = within(screen.getByRole('navigation')).getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(active.map((b) => b.textContent)).toEqual(['Dashboard']);
  });

  it('with no insight supplied there is no insight panel: the card is exactly the ready card', () => {
    mountDash('ready');
    expect(screen.queryByText(messages.widget.headerLabel)).toBeNull();
    expect(screen.queryByText(/Store manager/)).toBeNull();
  });

  it('shows a supplied insight inside the next job card: the label, the headline and the reason only, and nothing to press', () => {
    mountDash('insight');
    const card = screen.getByText('WO-4471 · 8:00 AM').closest('div[class*="jobFrame"]') as HTMLElement;
    expect(within(card).getByText(messages.widget.headerLabel)).toBeInTheDocument();
    expect(within(card).getByText('Bring a discharge valve')).toBeInTheDocument();
    expect(within(card).getByText(/The V-221 valve is not in your van/)).toBeInTheDocument();
    // Display-only: the only control in the card is the one that opens the job.
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual(['Open work order']);
    expect(within(card).queryAllByRole('link')).toHaveLength(0);
  });

  it('a bad insight shows the safe fallback in the card and leaves the rest of the Dashboard working', () => {
    const raw = withDashboard(rawTechnician(), 'insight');
    ((raw.zones.dashboard as { data: { next_job: { insight: unknown } } }).data.next_job.insight) = { type: 'hologram', schemaVersion: '9.9', payload: {} };
    const context = validated(raw);
    render(<Shell context={context} layout={resolveLayout(context)} runtime={makeRuntime(raw).runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    expect(screen.getByText(messages.widget.fallbackTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open work order' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/hologram|9\.9/);
  });

  it('shows a client note on the next job: who, when, and what they said, with the message icon', () => {
    mountDash('client-update');
    expect(screen.getByText('Store manager, 8:02 AM.')).toBeInTheDocument();
    expect(screen.getByText(/Use the south receiving entrance/)).toBeInTheDocument();
  });

  it('with no jobs: the same counts as zeros with no shapes, one empty card, and no job or lists', () => {
    const { container } = mountDash('no-jobs');
    const counts = within(screen.getByRole('group', { name: 'Your jobs' }));
    for (const label of ['Urgent', 'Late', 'Upcoming']) expect(counts.getByText(label).parentElement).toHaveTextContent('0');
    expect([...container.querySelectorAll('[class*="tile"]')].some((t) => t.querySelector('svg'))).toBe(false);
    expect(screen.getByText(messages.dashboard.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.dashboard.emptyBody)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open work order' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull();
  });

  it('shows supplied em dashes for counts that are not known, exactly as given', () => {
    const raw = withDashboard(rawTechnician());
    ((raw.zones.dashboard as { data: { counts: { value: unknown; status: unknown }[] } }).data.counts).forEach((c) => {
      c.value = '—';
      c.status = null;
    });
    const context = validated(raw);
    render(<Shell context={context} layout={resolveLayout(context)} runtime={makeRuntime(raw).runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  describe('while it refreshes (the zone is marked by the update pipeline)', () => {
    it('shows "Your jobs" with "Updating" beside it, and keeps every loaded row where it is', () => {
      const h = mountDash();
      expect(screen.queryByRole('heading', { name: 'Your jobs' })).toBeNull(); // ordinary states show no such row
      act(() => h.runtime.zones.beginRefresh('dashboard'));
      expect(screen.getByRole('heading', { name: 'Your jobs' })).toBeInTheDocument();
      expect(screen.getByText(messages.dashboard.updating).closest('[role="status"]')).not.toBeNull();
      expect(screen.getByText('Union Coffee Roasters')).toBeInTheDocument();
      expect(screen.getAllByText('Beacon Hotel')).toHaveLength(2); // today and tomorrow
    });

    it('at 30 seconds: says it is taking longer and that the jobs MAY not be current, and never claims they are stale', () => {
      const h = mountDash();
      act(() => {
        h.runtime.zones.beginRefresh('dashboard');
        h.runtime.zones.setRefreshDelayed('dashboard');
      });
      expect(screen.getByRole('heading', { name: 'Your jobs' })).toBeInTheDocument();
      expect(screen.getByText(messages.dashboard.freshnessWarning)).toBeInTheDocument();
      expect(messages.dashboard.freshnessWarning).toBe('Taking longer than usual to update. Your jobs may not be current.');
      expect(messages.dashboard.freshnessWarning).not.toMatch(/stale|out of date|old/i);
      expect(screen.queryByText(messages.dashboard.updating)).toBeNull();
      expect(screen.getByText('Union Coffee Roasters')).toBeInTheDocument(); // the loaded rows stay
    });
  });

  describe('a lost connection', () => {
    const lose = (h: ReturnType<typeof mountDash>) =>
      act(async () => {
        h.runtime.start();
        h.latest().open();
        h.latest().fail();
      });

    it('shows the supplied wording, keeps the loaded data on screen and marks the destinations that need a connection with the offline sign', async () => {
      const h = mountDash();
      await lose(h);
      expect(screen.getByText("Connection lost. You can keep viewing what's loaded. Sending is paused until you're back online.")).toBeInTheDocument();
      expect(screen.getByText('Union Coffee Roasters')).toBeInTheDocument();
      const nav = within(screen.getByRole('navigation'));
      // Only the destination that needs a connection carries the sign. Work Orders is already loaded and stays readable offline (design 04).
      expect(nav.getByRole('button', { name: /Assets/ })).toHaveAttribute('aria-disabled', 'true');
      expect(nav.getByRole('button', { name: /Work Orders/ })).not.toHaveAttribute('aria-disabled');
      // Dashboard is universal: its last known data can still be read, so it carries no offline sign.
      expect(nav.getByRole('button', { name: /Dashboard/ })).not.toHaveAttribute('aria-disabled');
      expect(nav.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
    });

    it('on a phone it is a strip across the whole width under the topbar, not inside the content', async () => {
      const h = mountDash();
      await lose(h);
      const banner = screen.getByText(/Connection lost/).closest('[role="status"]') as HTMLElement;
      expect(screen.getByRole('main').contains(banner)).toBe(false);
      expect(screen.getAllByRole('banner')[0].compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(document.querySelector('[data-canvas-root]')).toBe(banner.parentElement);
    });

    it('beside the content (desktop) it is inside the main column only, so it never moves the navigation', async () => {
      setWidth(1280);
      const h = mountDash();
      await lose(h);
      const banner = screen.getByText(/Connection lost/).closest('[role="status"]') as HTMLElement;
      expect(screen.getByRole('main').contains(banner)).toBe(true);
      // Nothing sits between the topbar and the navigation but the page itself.
      expect(screen.getByRole('navigation').contains(banner)).toBe(false);
      // It is not a child of the shell itself, which would push the navigation down: it lives in the content beside it.
      expect(banner.parentElement).not.toBe(document.querySelector('[data-canvas-root]'));
      expect(banner.closest('[class*="content"]')).not.toBeNull();
    });
  });

  describe('access revoked (BRD SR25)', () => {
    const MESSAGE = 'You no longer have access to the previous screen.';

    it('shows the SUPPLIED message with a Dismiss button, and it stays until dismissed', () => {
      const h = mountDash();
      act(() => h.runtime.revokeAccess(MESSAGE));
      expect(screen.getByText(MESSAGE)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: messages.revoked.dismiss })).toBeInTheDocument();
      act(() => h.runtime.zones.beginRefresh('dashboard'));
      expect(screen.getByText(MESSAGE)).toBeInTheDocument(); // an update does not clear it
      fireEvent.click(screen.getByRole('button', { name: messages.revoked.dismiss }));
      expect(screen.queryByText(MESSAGE)).toBeNull();
    });

    it('takes the worker to Dashboard when they were somewhere else, and leaves the navigation set unchanged', () => {
      pathname = '/jobs';
      const h = mountDash();
      const before = navLabels();
      act(() => h.runtime.revokeAccess(MESSAGE));
      expect(push).toHaveBeenCalledWith('/');
      expect(navLabels()).toEqual(before);
    });

    it('does not navigate when the worker is already on Dashboard', () => {
      const h = mountDash();
      act(() => h.runtime.revokeAccess(MESSAGE));
      expect(push).not.toHaveBeenCalled();
    });

    it('arrives as a bus message whose text is supplied, and ignores one with no text', async () => {
      const h = mountDash();
      await act(async () => {
        h.runtime.start();
        h.latest().open();
        h.latest().send({ type: 'access.revoked', message: MESSAGE });
      });
      expect(screen.getByText(MESSAGE)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: messages.revoked.dismiss }));
      await act(async () => void h.latest().send({ type: 'access.revoked' }));
      expect(screen.queryByRole('button', { name: messages.revoked.dismiss })).toBeNull();
    });
  });
});

// ------------------------------------------------------------------------------------------------------------------------------------
// Work Orders (approved design 04) and the work order hub it opens.
// ------------------------------------------------------------------------------------------------------------------------------------
describe('Shell: Work Orders (approved design 04)', () => {
  beforeEach(() => {
    setWidth(375);
    pathname = '/jobs';
  });
  const mountJobs = (variant: WorkOrdersVariant = 'assigned', dashboard = true) => {
    const base = dashboard ? withDashboard(rawTechnician()) : rawTechnician();
    const raw = withWorkOrders(base, variant);
    const context = validated(raw);
    const harness = makeRuntime(raw);
    const utils = render(<Shell context={context} layout={resolveLayout(context)} runtime={harness.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    return { ...harness, ...utils };
  };

  it('is headed by the SUPPLIED page heading, with the groups Today and Tomorrow in the order sent', () => {
    mountJobs();
    expect(screen.getByRole('heading', { level: 1, name: 'Work orders' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Today', 'Tomorrow']);
  });

  it('has no Context Header and no in-content tabs: the global navigation is the only one, with Work Orders active', () => {
    mountJobs();
    expect(screen.queryByRole('region', { name: messages.contextHeader.label })).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    const active = within(screen.getByRole('navigation')).getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(active.map((b) => b.textContent)).toEqual(['Work Orders']);
  });

  it('shows each job as a row: time (site-local), client, the status and the task, exactly as supplied', () => {
    mountJobs();
    const today = within(screen.getByRole('region', { name: 'Today' }));
    const first = today.getByText('Northfield Grocers, Store 118').closest('li') as HTMLElement;
    expect(within(first).getByText('8:00 AM')).toBeInTheDocument();
    expect(within(first).getByText('Urgent')).toBeInTheDocument();
    expect(within(first).getByText('Compressor fault - walk-in cooler temp alarm')).toBeInTheDocument();
    const second = today.getByText('Union Coffee Roasters').closest('li') as HTMLElement;
    expect(within(second).getByText('Late')).toBeInTheDocument();
    expect(within(today.getAllByRole('list')[0]).getAllByRole('listitem')).toHaveLength(7);
  });

  it('opening the ACTIVE job goes to the work order hub; any other job says its detail is not available yet and goes nowhere', () => {
    mountJobs();
    fireEvent.click(screen.getByText('Northfield Grocers, Store 118').closest('button')!);
    expect(push).toHaveBeenCalledWith('/work-order');
    push.mockClear();
    fireEvent.click(screen.getByText('Union Coffee Roasters').closest('button')!);
    expect(push).not.toHaveBeenCalled();
    expect(toastStore.getSnapshot().map((t) => t.message)).toContain(messages.workOrders.notLoaded);
  });

  it('with no assigned jobs: the heading and one empty card that says why, and no groups', () => {
    mountJobs('empty');
    expect(screen.getByRole('heading', { level: 1, name: 'Work orders' })).toBeInTheDocument();
    expect(screen.getByText('No work orders')).toBeInTheDocument();
    expect(screen.getByText('No jobs are assigned for today or tomorrow. New assignments appear here automatically.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  describe('offline', () => {
    it('keeps the loaded jobs visible and selectable, shows the banner, marks only Assets as needing a connection, and changes no status', async () => {
      const h = mountJobs();
      await act(async () => {
        h.runtime.start();
        h.latest().open();
        h.latest().fail();
      });
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
      expect(screen.getByText('Union Coffee Roasters')).toBeInTheDocument();
      expect(screen.getByText('Late')).toBeInTheDocument(); // the status as supplied, untouched
      // The banner is the one signal: the list adds no "not up to date" line of its own (approved design 04).
      expect(screen.queryByText(messages.zone.stale)).toBeNull();
      expect(screen.getByText('Union Coffee Roasters').closest('button')).not.toBeDisabled();
      const nav = within(screen.getByRole('navigation'));
      expect(nav.getByRole('button', { name: /Assets/ })).toHaveAttribute('aria-disabled', 'true');
      expect(nav.getByRole('button', { name: /Work Orders/ })).not.toHaveAttribute('aria-disabled');
      expect(nav.getByRole('button', { name: /Work Orders/ })).toHaveAttribute('aria-current', 'page');
    });

    it('a lost connection does not move the navigation on desktop: the banner is in the main column', async () => {
      setWidth(1280);
      const h = mountJobs();
      await act(async () => {
        h.runtime.start();
        h.latest().open();
        h.latest().fail();
      });
      const banner = screen.getByText(/Connection lost/).closest('[role="status"]') as HTMLElement;
      expect(screen.getByRole('main').contains(banner)).toBe(true);
    });
  });

  describe('the work order hub', () => {
    it('is the job workspace with its Context Header, and keeps Work Orders as the active destination', () => {
      pathname = '/work-order';
      mountJobs();
      expect(screen.getByRole('region', { name: messages.contextHeader.label })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: messages.workOrders.hubTitle })).toBeInTheDocument();
      expect(screen.getByText(messages.zones.alerts.title)).toBeInTheDocument();
      const active = within(screen.getByRole('navigation')).getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
      expect(active.map((b) => b.textContent)).toEqual(['Work Orders']);
    });
  });

  it('without a work orders zone (the practice API today) Work Orders shows the job workspace, as before', () => {
    const raw = rawTechnician();
    const context = validated(raw);
    render(<Shell context={context} layout={resolveLayout(context)} runtime={makeRuntime(raw).runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    expect(screen.getByText(messages.zones.alerts.title)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Work orders' })).toBeNull();
  });
});

describe('NavigationZone failure (BRD 1.0 error row 14)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('swaps only the navigation for a recovery surface with Dashboard and Refresh, and says so once', async () => {
    const onDashboard = vi.fn();
    const broken = [{ destinationId: 'x', label: 'Broken', icon: 'not-a-real-icon' as never }];
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
