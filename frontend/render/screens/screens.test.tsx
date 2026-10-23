// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ContextDegradedNotice,
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

  it('degraded notice uses the warning shape, not the error shape', () => {
    const { container } = render(<ContextDegradedNotice />);
    expect(container.querySelector('svg path[d^="M12 2.5"]')).not.toBeNull();
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
