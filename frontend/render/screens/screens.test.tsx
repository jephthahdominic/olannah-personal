// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AssemblingScreen,
  SessionExpiredScreen,
  SessionLoadingScreen,
  UnknownRoleScreen,
  WorkspaceRecoveryScreen,
} from './index';
import { messages } from '../messages';

// Shell-owned screens (BRD 1.0 section 6): wordmark, plain language, no navigation, no zones, no technical detail.

describe('shell screens', () => {
  it('session loading screen: wordmark, message and progress indicator; no navigation', () => {
    render(<SessionLoadingScreen slow={false} />);
    expect(screen.getByText('Olannah')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(messages.session.loading);
    expect(screen.getByRole('img', { name: messages.session.loadingStatus })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('session loading screen switches to the longer-than-expected message', () => {
    render(<SessionLoadingScreen slow />);
    expect(screen.getByRole('status')).toHaveTextContent(messages.session.loadingSlow);
  });


  it('recovery screen offers retry and contact support and shows no technical detail', () => {
    const onRetry = vi.fn();
    render(<WorkspaceRecoveryScreen onRetry={onRetry} supportHref="mailto:help@example.test" />);
    fireEvent.click(screen.getByRole('button', { name: messages.recovery.retry }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: messages.recovery.contactSupport })).toHaveAttribute('href', 'mailto:help@example.test');
    expect(document.body.textContent).not.toMatch(/timeout|schema|version|payload|undefined|error code|\b[45]\d\d\b/i);
  });

  it('unknown-role fallback has its own message and a retry', () => {
    render(<UnknownRoleScreen onRetry={() => {}} supportHref="mailto:help@example.test" />);
    expect(screen.getByRole('heading', { name: messages.unknownRole.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.recovery.retry })).toBeInTheDocument();
  });

  it('session expired screen says the session ended, warns about unsaved work, and offers log in', () => {
    const onLogIn = vi.fn();
    render(<SessionExpiredScreen onLogIn={onLogIn} />);
    expect(screen.getByRole('heading', { name: messages.expired.title })).toBeInTheDocument();
    expect(screen.getByText(/unsaved|not saved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: messages.expired.logIn }));
    expect(onLogIn).toHaveBeenCalled();
  });
});

// The approved design "02 Dashboard assembling": the shell is there at once, the content is a skeleton, and a slow load adds one plain message.
const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });

describe('AssemblingScreen (design 02: Dashboard assembling)', () => {
  afterEach(() => setWidth(1024));

  describe('on a phone', () => {
    beforeEach(() => setWidth(375));

    it('has a topbar with the wordmark and nothing else: no sync marker, no worker, no feedback link', () => {
      render(<AssemblingScreen slow={false} />);
      const bar = screen.getByRole('banner');
      expect(bar).toHaveTextContent('Olannah');
      expect(within(bar).queryAllByRole('button')).toHaveLength(0);
      expect(within(bar).queryAllByRole('img')).toHaveLength(0);
      expect(bar.textContent?.replace('O', '').trim()).toBe('Olannah');
    });

    it('shows Dashboard and More as live items, and leaves out the role slots that are not known yet', () => {
      render(<AssemblingScreen slow={false} />);
      const nav = screen.getByRole('navigation', { name: messages.nav.primaryLabel });
      // Only the two live items are real controls. The role slots are not announced at all.
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Dashboard', 'More']);
      expect(within(nav).getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getAllByRole('listitem', { hidden: true })).toHaveLength(2);
    });

    it('has the tab bar and no rail', () => {
      render(<AssemblingScreen slow={false} />);
      expect(screen.getAllByRole('navigation')).toHaveLength(1);
      expect(document.querySelector('[data-viewport="mobile"]')).not.toBeNull();
    });
  });

  describe('beside the content (tablet and desktop)', () => {
    beforeEach(() => setWidth(1280));

    it('shows Dashboard and Settings as live items; the role slots that are not known yet are left out', () => {
      render(<AssemblingScreen slow={false} />);
      const nav = screen.getByRole('navigation', { name: messages.nav.primaryLabel });
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Dashboard', 'Settings']);
    });

    it('lays the supporting panel beside the content, as the final screen does, so nothing moves when data arrives', () => {
      render(<AssemblingScreen slow={false} />);
      expect(screen.getByRole('complementary', { hidden: true })).toBeInTheDocument();
    });
  });

  describe('while assembling (under the delivery budget)', () => {
    it('says it is loading through a hidden status, shows no banner, and marks the content busy', () => {
      render(<AssemblingScreen slow={false} />);
      expect(screen.getByRole('status')).toHaveTextContent(messages.context.assembling);
      expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByText(messages.context.degraded)).toBeNull();
    });

    it('shows no content: every placeholder is hidden from assistive technology', () => {
      render(<AssemblingScreen slow={false} />);
      const main = screen.getByRole('main');
      expect(within(main).queryAllByRole('heading')).toHaveLength(0);
      expect(within(main).queryAllByRole('button')).toHaveLength(0);
      expect(within(main).queryAllByRole('img')).toHaveLength(0);
    });
  });

  describe('slow load (error row 2: over 800 ms, recoverable)', () => {
    it("says exactly: 'Your workspace is taking longer than expected to load. You don't need to do anything.'", () => {
      render(<AssemblingScreen slow />);
      expect(messages.context.degraded).toBe("Your workspace is taking longer than expected to load. You don't need to do anything.");
      expect(screen.getByRole('status')).toHaveTextContent(messages.context.degraded);
    });

    it('announces it politely: a status region, never an alert that interrupts', () => {
      render(<AssemblingScreen slow />);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('uses the warning shape (a triangle) because this is degraded, not failed', () => {
      const { container } = render(<AssemblingScreen slow />);
      expect(container.querySelector('svg path[d^="M12 2.5"]')).not.toBeNull();
      expect(container.querySelector('svg circle')).toBeNull();
    });

    it('asks nothing of the worker: no retry, no button and no link in the content', () => {
      render(<AssemblingScreen slow />);
      const main = screen.getByRole('main');
      expect(within(main).queryAllByRole('button')).toHaveLength(0);
      expect(within(main).queryAllByRole('link')).toHaveLength(0);
      expect(main.textContent).not.toMatch(/retry|try again/i);
    });

    it('keeps the same skeleton and navigation beneath the message, so the screen does not change shape', () => {
      const shape = (container: HTMLElement) => ({
        skeletonGroups: container.querySelectorAll('section[aria-hidden="true"]').length,
        navItems: container.querySelectorAll('nav li').length,
        slots: container.querySelectorAll('nav li > div[aria-hidden="true"]').length,
      });
      const { container: assembling } = render(<AssemblingScreen slow={false} />);
      const before = shape(assembling);
      const { container: slow } = render(<AssemblingScreen slow />);
      expect(shape(slow)).toEqual(before);
    });
  });

  describe('the design details that are not visible in a DOM test', () => {
    const css = (file: string) => readFileSync(join(__dirname, '..', '..', file), 'utf8');

    it('the skeleton stops shimmering under reduced motion', () => {
      expect(css('components/Skeleton/Skeleton.module.css')).toMatch(/prefers-reduced-motion: reduce\) \{[^}]*animation: none/);
    });

    it('the greeting bar is about 60% wide and 24px tall (60% and 1.5rem)', () => {
      expect(css('render/screens/AssemblingScreen.module.css')).toMatch(/\.titleBar \{ inline-size: 60%; block-size: 1\.5rem/);
    });

    it('the button placeholders are the 44px touch target, like the real buttons, so the page does not jump', () => {
      expect(css('render/screens/AssemblingScreen.module.css')).toMatch(/\.buttons > span \{ block-size: var\(--width-touch-target\)/);
    });
  });
});
