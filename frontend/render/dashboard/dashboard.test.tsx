// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => pathname }));
let pathname = '/';

import { Shell } from '../shell/Shell';
import { makeRuntime, type RuntimeHarness } from '@/tests/shellFixtures';
import { resetNavigationMemory } from '../navigation/navigationMemory';
import { toastStore } from '@/runtime/toasts';
import { liveRegion } from '@/runtime/liveRegion';
import { clearTelemetryBuffer, getBufferedEvents } from '@/runtime/telemetry';
import { technicianContext, estimatorContext } from '@/contracts/fixtures/context';
import { technicianDashboard, technicianDashboardWithNote, estimatorDashboard, contextPanel } from '@/contracts/fixtures/zones';
import type { ContextEnvelope } from '@/contracts';
import { messages } from '../messages';

const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
const withDashboard = (data: unknown, base: ContextEnvelope = technicianContext): ContextEnvelope => ({ ...base, zones: { ...base.zones, 'primary:dashboard': { status: 'ready', data } } });
const dashboardEvent = (data: unknown) => ({ type: 'zone.update', zoneId: 'primary:dashboard', payload: { status: 'ready', data } });

function mount(context: ContextEnvelope = technicianContext, layoutId: 'technician' | 'estimator' = 'technician', over: Parameters<typeof makeRuntime>[1] = {}) {
  const h = makeRuntime(context, over);
  const utils = render(<Shell context={context} layout={{ layoutId, unmappedRole: false }} runtime={h.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
  return { ...h, ...utils };
}
const startAndConnect = async (h: RuntimeHarness) => {
  await act(async () => {
    h.runtime.start();
    h.latest().open();
  });
};

beforeEach(() => {
  setWidth(1280);
  pathname = '/';
  push.mockClear();
  resetNavigationMemory();
  toastStore.clear();
  liveRegion.clear();
  clearTelemetryBuffer();
});
afterEach(() => {
  vi.useRealTimers();
  setWidth(1024);
});

describe('Dashboard content (supplied, never computed)', () => {
  it('renders the headline, figures and labels exactly as supplied', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
    expect(screen.getByText('Today summary')).toBeInTheDocument();
    for (const label of ['Jobs today', 'Late', 'On schedule']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows whatever greeting upstream supplies: the canvas never builds one from the clock or the name', () => {
    mount(withDashboard({ ...technicianDashboard, headline: 'Evening shift, Marcus' }));
    expect(screen.getByRole('heading', { name: 'Evening shift, Marcus' })).toBeInTheDocument();
    expect(screen.queryByText(/Good morning/)).toBeNull();
  });

  it('renders the next job: reference, site-local time formatted but not converted, status, location and the action', () => {
    mount();
    expect(screen.getByText(/WO-48213 · 10:30 AM/)).toBeInTheDocument();
    expect(screen.getByText('Northgate Grocers #4830', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('2180 Harbor Avenue · Receiving bay')).toBeInTheDocument();
  });

  it('the next-job action asks the shell to go to Work Orders (the canvas does the route change)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Open work order' }));
    expect(push).toHaveBeenCalledWith('/work-orders');
  });

  it('renders the queue in the supplied order with formatted site-local times and the supplied caption', () => {
    mount();
    const list = screen.getByRole('list', { name: 'Later today' });
    const rows = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows[0]).toContain('1:15 PM');
    expect(rows[0]).toContain('Union Coffee Roasters');
    expect(rows[1]).toContain('3:40 PM');
    expect(screen.getByText('2 stops')).toBeInTheDocument();
  });

  it('shows a pushed notice and the store-manager note (supplied)', () => {
    mount(withDashboard(technicianDashboardWithNote));
    expect(screen.getAllByText('Store-manager update received').length).toBeGreaterThan(0);
    expect(screen.getByText(/Use the south receiving entrance/)).toBeInTheDocument();
  });

  it('shows no next-job card and no placeholder when there is none to show', () => {
    mount(withDashboard({ ...technicianDashboard, featured: null }));
    expect(screen.queryByText('Next job')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open work order' })).toBeNull();
  });

  it('explains an empty queue instead of rendering it blank', () => {
    mount(withDashboard({ ...technicianDashboard, queue: [], queueCaption: undefined }));
    expect(screen.getByText(messages.dashboard.queueEmptyTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.dashboard.queueEmptyBody)).toBeInTheDocument();
  });

  it('renders the estimator dashboard from the same shell: figures with captions and a queue with status pills', () => {
    mount(estimatorContext, 'estimator');
    expect(screen.getByText('Priority queue')).toBeInTheDocument();
    expect(screen.getByText('2 need attention today')).toBeInTheDocument();
    expect(screen.getByText('$42,860 open value')).toBeInTheDocument();
    for (const status of ['Review now', 'Field review', 'Approved', 'Checkpoint']) expect(screen.getByText(status)).toBeInTheDocument();
    expect(screen.queryByText('Next job')).toBeNull();
  });

  it('a destination with no delivered data shows its empty explanation, never the dashboard', () => {
    pathname = '/work-orders';
    mount();
    expect(screen.getByText(messages.zone.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByText('Today summary')).toBeNull();
  });
});

describe('Context zone and the history second pass', () => {
  it('shows the supplied context immediately, with history in its loading state (never blank)', () => {
    mount();
    expect(screen.getByText(contextPanel.title, { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Context current')).toBeInTheDocument();
    expect(screen.getByText('Source: Service ERP')).toBeInTheDocument();
    const loading = screen.getByRole('status', { name: messages.history.loading });
    expect(loading).toHaveAttribute('aria-busy', 'true');
  });

  it('replaces the loading state with the delivered history, formatted without time zone conversion', async () => {
    const h = mount();
    await act(async () => void h.runtime.start());
    await act(async () => void (await Promise.resolve()));
    const list = await screen.findByRole('list', { name: contextPanel.historyTitle });
    expect(within(list).getByText('Sep 21')).toBeInTheDocument();
    expect(within(list).getByText('Slow recovery after delivery')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: messages.history.loading })).toBeNull();
    expect(h.historyRequest).toHaveBeenCalledWith(technicianContext.historyRef, null);
  });

  it('shows history as unavailable with a retry, while the dashboard keeps working', async () => {
    const h = mount(technicianContext, 'technician', { history: () => Promise.reject(new Error('down')) });
    await act(async () => void h.runtime.start());
    await act(async () => void (await Promise.resolve()));
    expect(await screen.findByText(messages.history.errorTitle)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
    h.historyRequest.mockResolvedValue({ records: [{ id: 'x', occurredOn: '2026-01-02', title: 'Recovered visit' }], nextCursor: null });
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.history.retry })));
    expect(await screen.findByText('Recovered visit')).toBeInTheDocument();
  });

  it('explains empty history rather than showing blank', async () => {
    const h = mount(technicianContext, 'technician', { history: async () => ({ records: [], nextCursor: null }) });
    await act(async () => void h.runtime.start());
    await act(async () => void (await Promise.resolve()));
    expect(await screen.findByText(messages.history.emptyTitle)).toBeInTheDocument();
  });
});

describe('Live updates through the bus', () => {
  it('shows the Updating indicator at once, applies the new data, and clears the indicator only after it has rendered', async () => {
    const h = mount(technicianContext, 'technician', { autoSchedule: false });
    await startAndConnect(h);
    expect(screen.queryByText(messages.zone.refreshing)).toBeNull();

    await act(async () => void h.latest().send(dashboardEvent(technicianDashboardWithNote)));
    // received, not yet applied: the old data is still on screen and the indicator is already showing
    expect(screen.getAllByText(messages.zone.refreshing).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Use the south receiving entrance/)).toBeNull();

    await act(async () => void h.flush());
    // applied and rendered: the new data is visible and the indicator is gone
    expect(screen.getByText(/Use the south receiving entrance/)).toBeInTheDocument();
    expect(screen.queryByText(messages.zone.refreshing)).toBeNull();
  });

  it('refreshes only the affected zone: the other zone shows no indicator', async () => {
    const h = mount(technicianContext, 'technician', { autoSchedule: false });
    await startAndConnect(h);
    await act(async () => void h.latest().send(dashboardEvent(technicianDashboardWithNote)));
    const zones = document.querySelectorAll('[data-zone]');
    const refreshing = [...zones].filter((z) => z.getAttribute('data-refreshing'));
    expect(refreshing.map((z) => z.getAttribute('data-zone'))).toEqual(['primary']);
  });

  it('the page and the navigation stay put during a refresh: no reload, same nav', async () => {
    const h = mount(technicianContext, 'technician', { autoSchedule: false });
    await startAndConnect(h);
    const nav = screen.getByRole('navigation');
    await act(async () => void h.latest().send(dashboardEvent(technicianDashboardWithNote)));
    expect(screen.getByRole('navigation')).toBe(nav);
    expect(push).not.toHaveBeenCalled();
  });

  it('turns the indicator into a warning after 30 seconds, keeps the data, and offers a retry', async () => {
    vi.useFakeTimers();
    const h = mount(technicianContext, 'technician', { autoSchedule: false });
    await startAndConnect(h);
    await act(async () => void h.latest().send(dashboardEvent(technicianDashboardWithNote))); // never flushed: never renders
    await act(async () => void (await vi.advanceTimersByTimeAsync(30_100)));
    expect(screen.getByText(messages.zone.refreshDelayed)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument(); // last data kept
    expect(screen.getByRole('button', { name: messages.zone.retry })).toBeInTheDocument();
    expect(getBufferedEvents().map((e) => e.event)).toContain('zone.refresh_delayed');
  });

  it('a malformed zone payload makes only that zone unavailable and leaves everything else working', async () => {
    const h = mount();
    await startAndConnect(h);
    await act(async () => void h.latest().send({ type: 'zone.update', zoneId: 'context', payload: { status: 'nonsense' } }));
    expect(screen.getByText(messages.zone.unavailableTitle)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('an unknown data shape is treated as malformed for that zone, not rendered as a guess', async () => {
    const h = mount();
    await startAndConnect(h);
    await act(async () => void h.latest().send(dashboardEvent({ kind: 'brand-new-widget' })));
    expect(screen.getByText(messages.zone.unavailableTitle)).toBeInTheDocument();
  });

  it.each([['garbage', 'not json {'], ['unknown zone id', { type: 'zone.update', zoneId: '../../x', payload: {} }], ['null', 'null']])('ignores %s without disturbing the screen', async (_n, raw) => {
    const h = mount();
    await startAndConnect(h);
    await act(async () => void h.latest().send(raw));
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
    expect(screen.queryByText(messages.zone.unavailableTitle)).toBeNull();
    expect(getBufferedEvents().map((e) => e.event)).toContain('bus.event_invalid');
  });
});

describe('Connection loss and recovery (BRD 1.0 error rows 8 and 9)', () => {
  it('shows a persistent warning banner, keeps the last data marked not up to date, and does not obscure content', async () => {
    const h = mount();
    await startAndConnect(h);
    expect(screen.queryByText(messages.connection.lost)).toBeNull();
    await act(async () => void h.latest().fail());
    expect(screen.getByText(messages.connection.lost)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
    expect(screen.getAllByText(messages.zone.stale).length).toBeGreaterThan(0);
    expect(within(screen.getByRole('banner')).getByText(messages.shell.stale)).toBeInTheDocument();
  });

  it('removes the banner and refreshes every zone when the connection returns', async () => {
    vi.useFakeTimers();
    const h = mount();
    await startAndConnect(h);
    await act(async () => void h.latest().fail());
    await act(async () => void (await vi.advanceTimersByTimeAsync(1100)));
    await act(async () => void h.latest().open());
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    expect(screen.queryByText(messages.connection.lost)).toBeNull();
    expect(h.contextRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(messages.zone.stale)).toBeNull();
  });

  it('escalates to an error banner with Try again and Contact support after reconnection fails', async () => {
    vi.useFakeTimers();
    const h = mount();
    await startAndConnect(h);
    await act(async () => void h.latest().fail());
    for (const wait of [1100, 2100, 4100]) {
      await act(async () => void (await vi.advanceTimersByTimeAsync(wait)));
      await act(async () => void h.latest().fail());
    }
    expect(screen.getByText(messages.connection.failed)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.connection.contactSupport })).toHaveAttribute('href', 'mailto:help@example.test');
    const before = h.sources.length;
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.connection.retry })));
    expect(h.sources.length).toBe(before + 1);
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
  });

  it('exposes whether writes are available: not while the connection is down', async () => {
    const h = mount();
    expect(h.runtime.canWrite).toBe(false);
    await startAndConnect(h);
    expect(h.runtime.canWrite).toBe(true);
    await act(async () => void h.latest().fail());
    expect(h.runtime.canWrite).toBe(false);
  });
});

describe('Topbar sync marker', () => {
  it('says Synced when everything is current, with freshness and connectivity as separate attributes', async () => {
    const h = mount();
    await startAndConnect(h);
    const dot = within(screen.getByRole('banner')).getByText(messages.shell.synced).closest('[data-freshness]')!;
    expect(dot).toHaveAttribute('data-freshness', 'fresh');
    expect(dot).toHaveAttribute('data-connectivity', 'connected');
  });

  it('says Updating while a zone refreshes', async () => {
    const h = mount(technicianContext, 'technician', { autoSchedule: false });
    await startAndConnect(h);
    await act(async () => void h.latest().send(dashboardEvent(technicianDashboardWithNote)));
    expect(within(screen.getByRole('banner')).getByText(messages.shell.updating)).toBeInTheDocument();
  });
});

describe('estimator dashboard updates', () => {
  it('applies a pushed estimator update through the same pipeline', async () => {
    const h = mount(estimatorContext, 'estimator');
    await startAndConnect(h);
    await act(async () => void h.latest().send(dashboardEvent({ ...estimatorDashboard, summary: [{ id: 'field-reviews', label: 'Field reviews', value: 9, tone: 'attention' }] })));
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
