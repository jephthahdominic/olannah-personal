// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';

const nav = vi.hoisted(() => ({ pathname: '/work-orders' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => nav.pathname }));

import { Shell } from './Shell';
import { makeRuntime } from '@/tests/shellFixtures';
import { act } from '@testing-library/react';
import { technicianDashboardWithNote } from '@/contracts/fixtures/zones';
import { SessionLoadingScreen, WorkspaceRecoveryScreen, SessionExpiredScreen, UnknownRoleScreen, ContextDegradedNotice } from '../screens';
import { technicianContext, estimatorContext } from '@/contracts/fixtures/context';

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
    ['technician, mobile', 375, technicianContext, 'technician'],
    ['technician, desktop', 1280, technicianContext, 'technician'],
    ['estimator, desktop', 1280, estimatorContext, 'estimator'],
  ] as const)('%s has no structural violations', async (_name, width, context, layoutId) => {
    setWidth(width);
    const { container } = render(<Shell context={context} layout={{ layoutId, unmappedRole: false }} runtime={makeRuntime(context).runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    expect(await violations(container)).toEqual([]);
  });
});

describe('axe: shell-owned screens', () => {
  it.each([
    ['session loading', <SessionLoadingScreen key="a" slow={false} />],
    ['session loading (slow)', <SessionLoadingScreen key="b" slow />],
    ['context degraded', <ContextDegradedNotice key="c" />],
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
    nav.pathname = '/work-orders';
    vi.useRealTimers();
  });

  const mountLive = (width: number) => {
    setWidth(width);
    const h = makeRuntime(technicianContext, { autoSchedule: false });
    const utils = render(<Shell context={technicianContext} layout={{ layoutId: 'technician', unmappedRole: false }} runtime={h.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
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
      h.latest().send({ type: 'zone.update', zoneId: 'primary:dashboard', payload: { status: 'ready', data: technicianDashboardWithNote } });
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
      h.latest().send({ type: 'zone.update', zoneId: 'primary:dashboard', payload: { status: 'ready', data: technicianDashboardWithNote } });
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
    const h = makeRuntime(technicianContext, { history: () => Promise.reject(new Error('down')) });
    const { container } = render(<Shell context={technicianContext} layout={{ layoutId: 'technician', unmappedRole: false }} runtime={h.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    await act(async () => void h.runtime.start());
    await act(async () => void (await Promise.resolve()));
    expect(await violations(container)).toEqual([]);
  });
});

describe('axe: assistant, feedback and insight widgets', () => {
  beforeEach(() => {
    nav.pathname = '/';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    nav.pathname = '/work-orders';
    vi.useRealTimers();
  });

  const mountShell = (width: number) => {
    setWidth(width);
    const h = makeRuntime(technicianContext);
    const utils = render(<Shell context={technicianContext} layout={{ layoutId: 'technician', unmappedRole: false }} runtime={h.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    return { h, ...utils };
  };

  it('the dashboard with its insight widget, desktop and mobile', async () => {
    for (const width of [1280, 375]) {
      const { container, unmount } = mountShell(width);
      expect(container.textContent).toContain('Bring a defrost control kit');
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

  it('with every fallback and degraded insight state', async () => {
    const h = makeRuntime(technicianContext, { autoSchedule: true });
    setWidth(1280);
    const { container } = render(<Shell context={technicianContext} layout={{ layoutId: 'technician', unmappedRole: false }} runtime={h.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />);
    await act(async () => {
      h.runtime.start();
      h.latest().open();
      h.latest().send({
        type: 'zone.update',
        zoneId: 'primary:dashboard',
        payload: {
          status: 'ready',
          data: {
            ...technicianDashboardWithNote,
            widgets: [
              { type: 'insight', schemaVersion: '9.9', payload: {} },
              { type: 'insight', schemaVersion: '1.0', payload: { title: 1 } },
              { type: 'insight', schemaVersion: '1.0', condition: 'degraded', degradedMessage: 'Built from partial history.', payload: { title: 'Likely fault', body: 'Pattern matches door events.' } },
            ],
          },
        },
      });
    });
    expect(container.textContent).toContain('Insight unavailable');
    expect(container.textContent).toContain('Built from partial history.');
    expect(await violations(container)).toEqual([]);
  });
});
