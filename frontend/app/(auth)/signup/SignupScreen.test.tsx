// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams('') }));

import { SignupScreen } from './SignupScreen';
import { getUpstream } from '@/clients/upstream';
import { resetThrottles } from '../throttles';
import { clearTelemetryBuffer, getBufferedEvents } from '@/runtime/telemetry';
import { messages } from '@/render/messages';

const auth = () => getUpstream().auth;
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const form = () => screen.getByRole('button', { name: new RegExp(messages.signup.submit) }).closest('form')!;
const submitButton = () => screen.getByRole('button', { name: new RegExp(`${messages.signup.submit}|${messages.signup.submitting}`) });
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

const GOOD = { name: 'Marcus Bell', email: 'marcus@example.com', password: 'a-long-enough-pass', confirm: 'a-long-enough-pass' };

beforeEach(() => {
  vi.useFakeTimers();
  resetThrottles();
  clearTelemetryBuffer();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function fill(v: Partial<typeof GOOD> = {}) {
  const d = { ...GOOD, ...v };
  type(messages.signup.fullName, d.name);
  type(messages.signup.email, d.email);
  type(messages.signup.password, d.password);
  type(messages.signup.confirmPassword, d.confirm);
}
async function submit() {
  await act(async () => {
    fireEvent.submit(form());
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe('signup: form hardening', () => {
  it('labels every field and sets the right autocomplete and anti-autocorrect attributes', () => {
    render(<SignupScreen />);
    expect(field(messages.signup.fullName)).toHaveAttribute('autocomplete', 'name');
    expect(field(messages.signup.fullName)).toHaveAttribute('maxlength', '80');
    expect(field(messages.signup.email)).toHaveAttribute('autocomplete', 'email');
    expect(field(messages.signup.email)).toHaveAttribute('autocapitalize', 'off');
    expect(field(messages.signup.password)).toHaveAttribute('autocomplete', 'new-password');
    expect(field(messages.signup.confirmPassword)).toHaveAttribute('autocomplete', 'new-password');
    expect(field(messages.signup.password)).toHaveAttribute('type', 'password');
    expect(form()).toHaveAttribute('novalidate');
  });

  it('states the password rule up front, and never asks the worker to choose a role', () => {
    render(<SignupScreen />);
    expect(screen.getByText(messages.signup.passwordHelp)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByLabelText(/role/i)).toBeNull();
  });

  it('links back to sign in', () => {
    render(<SignupScreen />);
    expect(screen.getByRole('link', { name: messages.signup.signInLink })).toHaveAttribute('href', '/login');
  });
});

describe('signup: zod validation', () => {
  it('reports every empty field, calls nothing, and focuses the first', async () => {
    const spy = vi.spyOn(auth(), 'signUp');
    render(<SignupScreen />);
    await act(async () => void fireEvent.submit(form()));
    expect(screen.getByText(messages.validation.name_required)).toBeInTheDocument();
    expect(screen.getByText(messages.validation.email_required)).toBeInTheDocument();
    expect(screen.getByText(messages.validation.password_required)).toBeInTheDocument();
    expect(screen.getByText(messages.validation.confirm_required)).toBeInTheDocument();
    expect(field(messages.signup.fullName)).toHaveFocus();
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    [{ password: 'short', confirm: 'short' }, messages.validation.password_too_short],
    [{ password: 'password1234', confirm: 'password1234' }, messages.validation.password_common],
    [{ password: 'marcus-is-great-1', confirm: 'marcus-is-great-1' }, messages.validation.password_contains_email],
    [{ confirm: 'a-different-password!' }, messages.validation.password_mismatch],
    [{ name: 'Robert<script>' }, messages.validation.name_invalid],
    [{ email: 'nope' }, messages.validation.email_invalid],
  ])('rejects %j with a plain-language message and does not submit', async (override, text) => {
    const spy = vi.spyOn(auth(), 'signUp');
    render(<SignupScreen />);
    fill(override);
    await act(async () => void fireEvent.submit(form()));
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('focuses the confirmation field when only the confirmation is wrong', async () => {
    render(<SignupScreen />);
    fill({ confirm: 'a-different-password!' });
    await act(async () => void fireEvent.submit(form()));
    expect(field(messages.signup.confirmPassword)).toHaveFocus();
  });

  it('clears a message as soon as the field is fixed, once the worker has tried', async () => {
    render(<SignupScreen />);
    fill({ confirm: 'nope-nope-nope-nope' });
    await act(async () => void fireEvent.submit(form()));
    expect(screen.getByText(messages.validation.password_mismatch)).toBeInTheDocument();
    type(messages.signup.confirmPassword, GOOD.password);
    expect(screen.queryByText(messages.validation.password_mismatch)).toBeNull();
  });
});

describe('signup: submission', () => {
  it('sends only the validated, normalized fields (no confirmation, no extras) to the provider', async () => {
    const spy = vi.spyOn(auth(), 'signUp').mockResolvedValue({ ok: true });
    render(<SignupScreen />);
    fill({ name: '  Marcus    Bell ', email: ' Marcus@Example.COM ' });
    await submit();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ fullName: 'Marcus Bell', email: 'marcus@example.com', password: GOOD.password });
  });

  it('click and disable: inputs lock, the button is busy and inert, and a burst of submits sends one request', async () => {
    const spy = vi.spyOn(auth(), 'signUp').mockImplementation(() => new Promise(() => {}));
    render(<SignupScreen />);
    fill();
    await act(async () => {
      fireEvent.submit(form());
      fireEvent.submit(form());
      fireEvent.click(submitButton());
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(field(messages.signup.fullName)).toBeDisabled();
    expect(field(messages.signup.password)).toBeDisabled();
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the same generic confirmation whether or not the address already exists (no account enumeration)', async () => {
    const { unmount } = render(<SignupScreen />);
    fill({ email: 'brand-new@example.com' });
    await submit();
    const first = screen.getByRole('status').textContent;
    unmount();

    resetThrottles();
    render(<SignupScreen />);
    fill({ email: 'technician@olannah.test' }); // an address that exists in the mock directory
    await submit();
    expect(screen.getByRole('status').textContent).toBe(first);
    expect(first).toContain(messages.signup.doneTitle);
    expect(first).toContain('If this address can be registered');
    expect(first).not.toMatch(/already|exists|taken|in use/i);
  });

  it('on success clears every secret from the form, moves focus to the confirmation, and offers a way back to sign in', async () => {
    vi.spyOn(auth(), 'signUp').mockResolvedValue({ ok: true });
    render(<SignupScreen />);
    fill();
    await submit();
    expect(screen.queryByLabelText(messages.signup.password)).toBeNull();
    expect(screen.getByRole('status')).toHaveFocus();
    expect(screen.getByRole('link', { name: messages.signup.backToSignIn })).toHaveAttribute('href', '/login');
    expect(document.body.textContent).not.toContain(GOOD.password);
  });

  it('on failure keeps the name and email, clears both passwords, refocuses the password, and releases the lock', async () => {
    vi.spyOn(auth(), 'signUp').mockResolvedValue({ ok: false, reason: 'unavailable' });
    render(<SignupScreen />);
    fill();
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(messages.signup.failures.unavailable);
    expect(field(messages.signup.fullName)).toHaveValue('Marcus Bell');
    expect(field(messages.signup.email)).toHaveValue('marcus@example.com');
    expect(field(messages.signup.password)).toHaveValue('');
    expect(field(messages.signup.confirmPassword)).toHaveValue('');
    expect(field(messages.signup.password)).toHaveFocus();
    expect(field(messages.signup.fullName)).not.toBeDisabled();
  });

  it('survives the provider throwing', async () => {
    vi.spyOn(auth(), 'signUp').mockRejectedValue(new Error('boom'));
    render(<SignupScreen />);
    fill();
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(messages.signup.failures.network);
    expect(field(messages.signup.fullName)).not.toBeDisabled();
  });

  it('the mock server re-validates: a form bypassed in the browser is still rejected', async () => {
    const result = await Promise.all([
      (async () => {
        const p = auth().signUp({ fullName: 'A', email: 'nope', password: 'x' });
        await vi.advanceTimersByTimeAsync(500);
        return p;
      })(),
    ]);
    expect(result[0]).toEqual({ ok: false, reason: 'rejected' });
  });
});

describe('signup: attempt throttle', () => {
  it('disables submit with a countdown after repeated server failures', async () => {
    const spy = vi.spyOn(auth(), 'signUp').mockResolvedValue({ ok: false, reason: 'rejected' });
    render(<SignupScreen />);
    for (let i = 0; i < 6; i++) {
      fill();
      await submit();
    }
    expect(spy).toHaveBeenCalledTimes(6);
    expect(screen.getByText(messages.login.throttled(30))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    await act(async () => void fireEvent.submit(form()));
    expect(spy).toHaveBeenCalledTimes(6);
  });
});

describe('signup: no secrets leak', () => {
  it('never logs a password, a name, or an email', async () => {
    vi.spyOn(auth(), 'signUp').mockResolvedValue({ ok: false, reason: 'rejected' });
    render(<SignupScreen />);
    fill({ name: 'Marcus Bell', email: 'marcus@example.com', password: 'Sup3r-Secret-Value!', confirm: 'Sup3r-Secret-Value!' });
    await submit();
    const serialized = JSON.stringify(getBufferedEvents());
    for (const secret of ['Sup3r-Secret-Value!', 'marcus@example.com', 'Marcus Bell']) expect(serialized).not.toContain(secret);
    expect(getBufferedEvents().map((e) => e.event)).toContain('auth.sign_up_failed');
    expect(window.location.href).not.toContain('Sup3r');
  });
});
