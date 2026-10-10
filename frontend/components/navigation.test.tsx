// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { NavItem, NavigationRail, TabBar, MoreMenu, Toast, Skeleton, StatusPill, DegradedBanner, InlineError, EmptyState, SyncDot, type NavItemModel } from './index';

const items: NavItemModel[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', active: true },
  { id: 'work-orders', label: 'Work Orders', icon: 'clipboard-list' },
  { id: 'settings', label: 'Settings', icon: 'settings', pinned: true },
];

describe('NavItem', () => {
  it('marks the supplied active item as the current page, and only that one', () => {
    render(<NavigationRail items={items} ariaLabel="Main navigation" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Work Orders/ })).not.toHaveAttribute('aria-current');
  });

  it('active is communicated by more than color: a distinct class (indicator shape) and a heavier label style', () => {
    render(<NavigationRail items={items} ariaLabel="Main navigation" onSelect={() => {}} />);
    const active = screen.getByRole('button', { name: /Dashboard/ });
    const inactive = screen.getByRole('button', { name: /Work Orders/ });
    expect(active.className).toMatch(/active/);
    expect(inactive.className).not.toMatch(/active/);
    expect(active.className).toContain('type-nav-label-active');
    expect(inactive.className).toContain('type-nav-label');
  });

  it('emits the destination id on activation and performs no navigation itself', () => {
    const onActivate = vi.fn();
    render(<NavItem id="assets" label="Assets" icon="building-warehouse" layout="rail" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onActivate).toHaveBeenCalledWith('assets');
  });

  it('an unavailable item stays focusable, keeps full contrast, shows a marker, exposes its reason, and still activates', () => {
    const onActivate = vi.fn();
    render(<NavItem id="assets" label="Assets" icon="building-warehouse" layout="rail" unavailable unavailableReason="This area needs a connection." onActivate={onActivate} />);
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('This area needs a connection.');
    // a persistent marker shape accompanies it, and it is not the dimmed disabled treatment
    expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledWith('assets');
  });

  it('shows both the current indicator and the unavailable marker when a destination is current and unavailable', () => {
    render(<NavItem id="assets" label="Assets" icon="building-warehouse" layout="rail" active unavailable unavailableReason="Needs a connection." onActivate={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-current', 'page');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('NavigationRail and TabBar render exactly what they are given', () => {
  it('rail keeps supplied order and pins Settings last, as a labelled navigation landmark', () => {
    render(<NavigationRail items={items} ariaLabel="Main navigation" onSelect={() => {}} />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Dashboard', 'Work Orders', 'Settings']);
  });

  it('tab bar renders the supplied items in order and reports the menu item as a popup', () => {
    const mobile: NavItemModel[] = [items[0], items[1], { id: 'more', label: 'More', icon: 'dots' }];
    render(<TabBar items={mobile} ariaLabel="Main navigation" onSelect={() => {}} menuItemId="more" menuOpen={false} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Dashboard', 'Work Orders', 'More']);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  it('selecting an item emits its id upward', () => {
    const onSelect = vi.fn();
    render(<NavigationRail items={items} ariaLabel="Main navigation" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Work Orders/ }));
    expect(onSelect).toHaveBeenCalledWith('work-orders');
  });
});

describe('MoreMenu', () => {
  const actions = [
    { id: 'ask', icon: 'sparkles' as const, title: 'Ask Olannah', description: 'Get help' },
    { id: 'feedback', icon: 'message' as const, title: 'Feedback', description: 'Tell us' },
    { id: 'settings', icon: 'settings' as const, title: 'Settings', description: 'Account' },
  ];

  function Harness({ onAction = () => {} }: { onAction?: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>opener</button>
        <MoreMenu open={open} actions={actions} onCloseRequest={() => setOpen(false)} onActionSelect={onAction} onDestinationSelect={() => {}} />
      </>
    );
  }

  it('renders nothing while closed (the composing layer owns the open state)', () => {
    render(<MoreMenu open={false} actions={actions} onCloseRequest={() => {}} onActionSelect={() => {}} onDestinationSelect={() => {}} />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows the three fixed actions with title and description', () => {
    render(<MoreMenu open actions={actions} onCloseRequest={() => {}} onActionSelect={() => {}} onDestinationSelect={() => {}} />);
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Ask OlannahGet help', 'FeedbackTell us', 'SettingsAccount']);
  });

  it('moves focus to the first item when it opens', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('opener'));
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
  });

  it('Escape asks to close, and focus returns to the opener', () => {
    render(<Harness />);
    const opener = screen.getByText('opener');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('a tap on the dim overlay closes everything', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('opener'));
    fireEvent.click(screen.getByTestId('more-overlay'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps focus inside while open (Tab wraps from last to first and back)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('opener'));
    const menu = screen.getAllByRole('menuitem');
    menu[menu.length - 1].focus();
    fireEvent.keyDown(menu[menu.length - 1], { key: 'Tab' });
    expect(menu[0]).toHaveFocus();
    fireEvent.keyDown(menu[0], { key: 'Tab', shiftKey: true });
    expect(menu[menu.length - 1]).toHaveFocus();
  });

  it('emits the chosen action id', () => {
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    fireEvent.click(screen.getByText('opener'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Feedback/ }));
    expect(onAction).toHaveBeenCalledWith('feedback');
  });
});

describe('Toast (BRD 1.2 5.8 Feature 8)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('auto-dismisses after the supplied duration (default 7s)', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" dismissLabel="Dismiss" onDismiss={onDismiss} />);
    act(() => void vi.advanceTimersByTime(6999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('pauses while hovered and resumes on leave, keeping the time already spent', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" dismissLabel="Dismiss" onDismiss={onDismiss} />);
    const toast = screen.getByRole('status');
    act(() => void vi.advanceTimersByTime(5000));
    fireEvent.mouseEnter(toast);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(toast);
    act(() => void vi.advanceTimersByTime(1900));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(200));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss while focus is inside it, and can be dismissed by hand', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" dismissLabel="Dismiss" onDismiss={onDismiss} />);
    const button = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.focus(button);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('feedback and status components', () => {
  it('skeleton does not shimmer on action buttons or card frames, and shimmers elsewhere', () => {
    const shimmer = (shape: Parameters<typeof Skeleton>[0]['shape']) => {
      const { container, unmount } = render(<Skeleton shape={shape} />);
      const cls = (container.firstChild as HTMLElement).className;
      unmount();
      return /shimmer/.test(cls);
    };
    expect(shimmer('action-button')).toBe(false);
    expect(shimmer('card')).toBe(false);
    for (const s of ['title', 'body', 'body-short', 'field-label', 'field-value', 'data-value', 'icon', 'avatar', 'context-row'] as const) expect(shimmer(s)).toBe(true);
  });

  it('skeleton is hidden from assistive technology', () => {
    const { container } = render(<Skeleton shape="title" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('status pill always carries a shape and its text', () => {
    render(<StatusPill label="Needs review" tone="warning" />);
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(document.querySelector('svg')).not.toBeNull();
  });

  it('degraded and failed are visually distinct: different shape and different live-region role', () => {
    const degraded = render(<InlineError tone="degraded" title="Limited" />);
    const degradedShape = degraded.container.querySelector('svg')!.innerHTML;
    degraded.unmount();
    const failed = render(<InlineError tone="failure" title="Failed" />);
    const failedShape = failed.container.querySelector('svg')!.innerHTML;
    expect(degradedShape).not.toBe(failedShape);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('inline error renders only the supplied text, offers recovery actions, and exposes no code', () => {
    const onRetry = vi.fn();
    render(<InlineError title="This section is unavailable" body="We could not load it." retryLabel="Try again" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/\b[A-Z]{2,}-[A-Z]{2}-\d+\b/);
  });

  it('degraded banner announces politely and uses the error severity only when told to', () => {
    const { rerender } = render(<DegradedBanner message="Connection lost" />);
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost');
    const warningShape = document.querySelector('svg')!.innerHTML;
    rerender(<DegradedBanner message="Reconnection failed" severity="error" />);
    expect(document.querySelector('svg')!.innerHTML).not.toBe(warningShape);
  });

  it('empty state explains why and offers no error treatment', () => {
    render(<EmptyState title="Nothing here" explanation="Work appears when it is assigned." />);
    expect(screen.getByText('Work appears when it is assigned.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sync dot keeps freshness and connectivity as separate dimensions, with visible text', () => {
    const { container, rerender } = render(<SyncDot freshness="stale" connectivity="connected" label="Stale" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('data-freshness', 'stale');
    expect(el).toHaveAttribute('data-connectivity', 'connected');
    rerender(<SyncDot freshness="fresh" connectivity="disconnected" label="Offline" />);
    expect(el).toHaveAttribute('data-freshness', 'fresh');
    expect(el).toHaveAttribute('data-connectivity', 'disconnected');
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
