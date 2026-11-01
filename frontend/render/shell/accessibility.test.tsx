// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';

const nav = vi.hoisted(() => ({ pathname: '/jobs' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => nav.pathname }));

import { Shell } from './Shell';
import { makeRuntime } from '@/tests/shellFixtures';
import { act } from '@testing-library/react';
import { SessionLoadingScreen, WorkspaceRecoveryScreen, SessionExpiredScreen, UnknownRoleScreen, AssemblingScreen } from '../screens';
import { rawEstimator, rawFixture, rawTechnician, validated, type RawContext } from '@/tests/wireFixtures';
import { resolveLayout } from '@/runtime/boot/layoutRegistry';
import { withDashboard, type DashboardVariant } from '@/contracts/fixtures/dashboard';
import { withWorkOrders, type WorkOrdersVariant } from '@/contracts/fixtures/workOrders';

// The shell as the boot machine hands it over: a validated context and the layout resolved from it.
const shellFor = (raw: RawContext, runtime: ReturnType<typeof makeRuntime>['runtime']) => {
  const context = validated(raw);
  return <Shell context={context} layout={resolveLayout(context)} runtime={runtime} signOut={() => {}} supportHref="mailto:help@example.test" />;
};
const NEW_ALERTS = { state: 'rendered', as_of: '2026-10-23T09:00:00-05:00', data: [{ id: 'a9', severity: 'critical', message: 'Store manager update received', suggestion: null, evidence: [] }] };

// Automated accessibility audit (BRD 1.0 UR15). jsdom cannot compute color contrast, which the contrast gate covers
// against the real token values. This catches structural problems: names, roles, landmarks, ids, labels.
// An automated audit is necessary but NOT sufficient: manual keyboard and screen reader passes are still required.
async function violations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
afterEach(() => setWidth(1024));

describe('axe: shell', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  it.each([
    ['technician, mobile', 375, rawTechnician],
    ['technician, desktop', 1280, rawTechnician],
    ['estimator, desktop', 1280, rawEstimator],
  ] as const)('%s has no structural violations', async (_name, width, make) => {
    setWidth(width);
    const raw = make();
    const { container } = render(shellFor(raw, makeRuntime(raw).runtime));
    expect(await violations(container)).toEqual([]);
  });
});

describe('axe: shell-owned screens', () => {
  it.each([
    ['session loading', <SessionLoadingScreen key="a" slow={false} />],
    ['session loading (slow)', <SessionLoadingScreen key="b" slow />],
    ['assembling', <AssemblingScreen key="c" slow={false} />],
    ['assembling, slow load', <AssemblingScreen key="c2" slow />],
    ['workspace recovery', <WorkspaceRecoveryScreen key="d" onRetry={() => {}} supportHref="mailto:help@example.test" />],
    ['unknown role', <UnknownRoleScreen key="e" onRetry={() => {}} supportHref="mailto:help@example.test" />],
    ['session expired', <SessionExpiredScreen key="f" onLogIn={() => {}} />],
  ])('%s has no structural violations', async (_name, element) => {
    const { container } = render(element);
    expect(await violations(container)).toEqual([]);
  });
});

describe('axe: live states (indicators, banners, history)', () => {
  beforeEach(() => {
    nav.pathname = '/'; // the Dashboard, where the live data is
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    nav.pathname = '/jobs';
    vi.useRealTimers();
  });

  const mountLive = (width: number) => {
    setWidth(width);
    const raw = rawTechnician();
    const h = makeRuntime(raw, { autoSchedule: false });
    const utils = render(shellFor(raw, h.runtime));
    return { h, ...utils };
  };

  it.each([['mobile', 375], ['desktop', 1280]] as const)('dashboard with history loading, %s', async (_n, width) => {
    const { container } = mountLive(width);
    expect(await violations(container)).toEqual([]);
  });

  it('while a zone is refreshing', async () => {
    const { h, container } = mountLive(1280);
    await act(async () => {
      h.runtime.start();
      h.latest().open();
      h.latest().send({ type: 'zone.update', zoneId: 'alerts', payload: NEW_ALERTS });
    });
    expect(container.querySelector('[data-refreshing]')).not.toBeNull();
    expect(await violations(container)).toEqual([]);
  });

  it('with the delayed-refresh warning', async () => {
    vi.useFakeTimers();
    const { h, container } = mountLive(1280);
    await act(async () => {
      h.runtime.start();
      h.latest().open();
      h.latest().send({ type: 'zone.update', zoneId: 'alerts', payload: NEW_ALERTS });
    });
    await act(async () => void (await vi.advanceTimersByTimeAsync(30_100)));
    vi.useRealTimers(); // axe uses timers internally and hangs under fake ones
    expect(await violations(container)).toEqual([]);
  });

  it('with the connection-lost banner and stale zones', async () => {
    const { h, container } = mountLive(1280);
    await act(async () => {
      h.runtime.start();
      h.latest().open();
      h.latest().fail();
    });
    expect(await violations(container)).toEqual([]);
  });

  it('with the reconnection-failed banner', async () => {
    vi.useFakeTimers();
    const { h, container } = mountLive(1280);
    await act(async () => {
      h.runtime.start();
      h.latest().open();
      h.latest().fail();
    });
    for (const wait of [1100, 2100, 4100]) {
      await act(async () => void (await vi.advanceTimersByTimeAsync(wait)));
      await act(async () => void h.latest().fail());
    }
    vi.useRealTimers();
    expect(await violations(container)).toEqual([]);
  });

  it('with history delivered', async () => {
    const { h, container } = mountLive(1280);
    await act(async () => void h.runtime.start());
    await act(async () => void (await Promise.resolve()));
    expect(await violations(container)).toEqual([]);
  });

  it('with history unavailable', async () => {
    setWidth(1280);
    const raw = rawTechnician();
    const h = makeRuntime(raw, { history: () => Promise.reject(new Error('down')) });
    const { container } = render(shellFor(raw, h.runtime));
    await act(async () => void h.runtime.start());
    await act(async () => void (await Promise.resolve()));
    expect(await violations(container)).toEqual([]);
  });
});

describe('axe: assistant and feedback', () => {
  beforeEach(() => {
    nav.pathname = '/';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    nav.pathname = '/jobs';
    vi.useRealTimers();
  });

  const mountShell = (width: number) => {
    setWidth(width);
    const raw = rawTechnician();
    const h = makeRuntime(raw);
    const utils = render(shellFor(raw, h.runtime));
    return { h, ...utils };
  };

  it.each([
    'context.happy',
    'context.clear',
    'context.busy',
    'context.no-active-job',
    'context.sitedocs-and-xoi-down',
    'context.sampro-down',
    'context.malformed-zone',
    'context.unmapped-role',
  ])('the workspace for the practice scenario %s, desktop and mobile', async (file) => {
    for (const width of [1280, 375]) {
      setWidth(width);
      const raw = rawFixture(file);
      const { container, unmount } = render(shellFor(raw, makeRuntime(raw).runtime));
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });

  it('with the assistant trigger (closed) on desktop', async () => {
    const { container } = mountShell(1280);
    expect(container.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull();
    expect(await violations(container)).toEqual([]);
  });

  it('with the assistant open, desktop floating panel and mobile bottom sheet', async () => {
    for (const width of [1280, 375]) {
      const { unmount } = mountShell(width);
      await act(async () => {
        if (width === 1280) document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click();
        else {
          document.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
        }
      });
      if (width === 375) await act(async () => void [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((e) => e.textContent?.includes('Ask Olannah'))!.click());
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      expect(await violations(document.body)).toEqual([]);
      unmount();
    }
  });

  it('with the feedback form open, idle, with a validation error, and on success', async () => {
    const { h } = mountShell(1280);
    await act(async () => void [...document.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === 'Feedback')!.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(await violations(document.body)).toEqual([]);
    await act(async () => void document.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit());
    expect(document.body.textContent).toContain('Write a few words');
    expect(await violations(document.body)).toEqual([]);
    expect(h.feedbackSubmit).not.toHaveBeenCalled();
  });
});

describe('axe: the Dashboard (approved design 03), every state, phone and desktop', () => {
  beforeEach(() => {
    nav.pathname = '/';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    nav.pathname = '/jobs';
  });
  const mountDash = (variant: DashboardVariant) => {
    const raw = withDashboard(rawTechnician(), variant);
    const h = makeRuntime(raw);
    const utils = render(shellFor(raw, h.runtime));
    return { h, ...utils };
  };

  it.each(['ready', 'insight', 'client-update', 'no-jobs'] as const)('the %s dashboard', async (variant) => {
    for (const width of [375, 1280]) {
      setWidth(width);
      const { container, unmount } = mountDash(variant);
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });

  it('while refreshing, and with the 30 second warning', async () => {
    for (const width of [375, 1280]) {
      setWidth(width);
      const { h, container, unmount } = mountDash('ready');
      await act(async () => void h.runtime.zones.beginRefresh('dashboard'));
      expect(await violations(container)).toEqual([]);
      await act(async () => void h.runtime.zones.setRefreshDelayed('dashboard'));
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });

  it('with the connection lost (offline sign in the navigation), phone and desktop', async () => {
    for (const width of [375, 1280]) {
      setWidth(width);
      const { h, container, unmount } = mountDash('ready');
      await act(async () => {
        h.runtime.start();
        h.latest().open();
        h.latest().fail();
      });
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });

  it('with access revoked', async () => {
    for (const width of [375, 1280]) {
      setWidth(width);
      const { h, container, unmount } = mountDash('ready');
      await act(async () => void h.runtime.revokeAccess('You no longer have access to the previous screen.'));
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });
});

describe('axe: Work Orders (approved design 04), every state, phone and desktop', () => {
  beforeEach(() => {
    nav.pathname = '/jobs';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  const mountJobs = (variant: WorkOrdersVariant) => {
    const raw = withWorkOrders(withDashboard(rawTechnician()), variant);
    const h = makeRuntime(raw);
    const utils = render(shellFor(raw, h.runtime));
    return { h, ...utils };
  };

  it.each(['assigned', 'empty'] as const)('the %s list', async (variant) => {
    for (const width of [375, 1280]) {
      setWidth(width);
      const { container, unmount } = mountJobs(variant);
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });

  it('while more jobs load, and offline', async () => {
    for (const width of [375, 1280]) {
      setWidth(width);
      const { h, container, unmount } = mountJobs('assigned');
      await act(async () => {
        h.runtime.start();
        h.latest().open();
        h.latest().fail();
      });
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });

  it('the work order hub', async () => {
    nav.pathname = '/work-order';
    for (const width of [375, 1280]) {
      setWidth(width);
      const { container, unmount } = mountJobs('assigned');
      expect(await violations(container)).toEqual([]);
      unmount();
    }
  });
});
