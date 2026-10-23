// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

import { LoginScreen } from './LoginScreen';
import { getUpstream } from '@/clients/upstream';
import { resetThrottles } from '../throttles';
import { clearTelemetryBuffer, getBufferedEvents } from '@/runtime/telemetry';
import { messages } from '@/render/messages';

const auth = () => getUpstream().auth;
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const form = () => screen.getByRole('button', { name: new RegExp(messages.login.submit) }).closest('form')!;
const submitButton = () => screen.getByRole('button', { name: new RegExp(`${messages.login.submit}|${messages.login.submitting}`) });
const email = () => screen.getByLabelText(messages.login.email) as HTMLInputElement;
const password = () => screen.getByLabelText(messages.login.password) as HTMLInputElement;

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  search = '';
  resetThrottles();
  clearTelemetryBuffer();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const fail = (reason: 'invalid_credentials' | 'locked' | 'unavailable' | 'network' | 'rate_limited' = 'invalid_credentials') =>
  vi.spyOn(auth(), 'signIn').mockResolvedValue({ ok: false, reason });

async function fillAndSubmit(e = 'marcus@example.com', p = 'correct horse battery') {
  type(messages.login.email, e);
  type(messages.login.password, p);
  await act(async () => void fireEvent.submit(form()));
}

describe('login: form hardening', () => {
  it('labels every field visibly and sets password-manager and anti-autocorrect attributes', () => {
    render(<LoginScreen />);
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'username');
    expect(email()).toHaveAttribute('autocapitalize', 'off');
    expect(email()).toHaveAttribute('spellcheck', 'false');
    expect(email()).toHaveAttribute('maxlength', '254');
    expect(password()).toHaveAttribute('type', 'password');
    expect(password()).toHaveAttribute('autocomplete', 'current-password');
    expect(password()).toHaveAttribute('maxlength', '128');
    expect(email()).not.toHaveAttribute('placeholder');
    expect(form()).toHaveAttribute('novalidate');
  });

  it('never blocks paste (blocking it defeats password managers)', () => {
    render(<LoginScreen />);
    expect(fireEvent.paste(password(), { clipboardData: { getData: () => 'pasted' } })).toBe(true);
  });

  it('can show and hide the password, with a pressed state and a supplied name', () => {
    render(<LoginScreen />);
    const toggle = screen.getByRole('button', { name: messages.login.showPassword });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(password()).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', { name: messages.login.hidePassword });
    expect(hide).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(hide);
    expect(password()).toHaveAttribute('type', 'password');
  });
});

describe('login: zod validation', () => {
  it('shows a plain-language message per field, calls nothing, and focuses the first invalid field', async () => {
    const spy = vi.spyOn(auth(), 'signIn');
    render(<LoginScreen />);
    await act(async () => void fireEvent.submit(form()));
    expect(screen.getByText(messages.validation.email_required)).toBeInTheDocument();
    expect(screen.getByText(messages.validation.password_required)).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveAccessibleDescription(messages.validation.email_required);
    expect(email()).toHaveFocus();
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a malformed email without calling the provider', async () => {
    const spy = vi.spyOn(auth(), 'signIn');
    render(<LoginScreen />);
    await fillAndSubmit('not-an-email', 'x');
    expect(screen.getByText(messages.validation.email_invalid)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('focuses the password field when only the password is wrong', async () => {
    render(<LoginScreen />);
    await fillAndSubmit('a@b.co', '');
    expect(password()).toHaveFocus();
  });

  it('re-checks as the worker types once they have tried, so a fixed field clears its message', async () => {
    render(<LoginScreen />);
    await act(async () => void fireEvent.submit(form()));
    expect(screen.getByText(messages.validation.email_required)).toBeInTheDocument();
    type(messages.login.email, 'a@b.co');
    expect(screen.queryByText(messages.validation.email_required)).toBeNull();
  });

  it('validation failures do not count toward the attempt throttle', async () => {
    render(<LoginScreen />);
    for (let i = 0; i < 8; i++) await act(async () => void fireEvent.submit(form()));
    expect(submitButton()).not.toBeDisabled();
    expect(screen.queryByText(/Too many attempts/)).toBeNull();
  });

  it('sends the normalized email and the untouched password to the provider', async () => {
    const spy = vi.spyOn(auth(), 'signIn').mockResolvedValue({ ok: true });
    render(<LoginScreen />);
    await fillAndSubmit('  Marcus@Example.COM ', '  spaces kept  ');
    expect(spy).toHaveBeenCalledWith({ email: 'marcus@example.com', password: '  spaces kept  ' });
  });
});

describe('login: click and disable', () => {
  it('locks on submit: inputs are disabled, the button is busy and inert, and a second submit does nothing', async () => {
    let resolve!: (v: { ok: true }) => void;
    const spy = vi.spyOn(auth(), 'signIn').mockReturnValue(new Promise((r) => (resolve = r)));
    render(<LoginScreen />);
    type(messages.login.email, 'a@b.co');
    type(messages.login.password, 'secret-value');

    await act(async () => void fireEvent.submit(form()));
    expect(email()).toBeDisabled();
    expect(password()).toBeDisabled();
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
    expect(form()).toHaveAttribute('aria-busy', 'true');

    await act(async () => void fireEvent.click(submitButton()));
    await act(async () => void fireEvent.submit(form()));
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ ok: true }));
  });

  it('survives a burst of submissions in the same tick (click plus Enter plus script submit): one request', async () => {
    const spy = vi.spyOn(auth(), 'signIn').mockImplementation(() => new Promise(() => {}));
    render(<LoginScreen />);
    type(messages.login.email, 'a@b.co');
    type(messages.login.password, 'secret-value');
    await act(async () => {
      fireEvent.submit(form());
      fireEvent.submit(form());
      fireEvent.click(submitButton());
      fireEvent.submit(form());
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stays locked after success until the page navigates, so a slow redirect cannot submit twice', async () => {
    const spy = vi.spyOn(auth(), 'signIn').mockResolvedValue({ ok: true });
    render(<LoginScreen />);
    await fillAndSubmit();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
    await act(async () => void fireEvent.submit(form()));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(email()).toBeDisabled();
  });

  it('releases the lock after a failure so the worker can try again', async () => {
    fail();
    render(<LoginScreen />);
    await fillAndSubmit();
    expect(email()).not.toBeDisabled();
    expect(submitButton()).not.toHaveAttribute('aria-busy');
    expect(submitButton()).not.toHaveAttribute('aria-disabled');
  });

  it('releases the lock if the provider throws', async () => {
    vi.spyOn(auth(), 'signIn').mockRejectedValue(new Error('boom'));
    render(<LoginScreen />);
    await fillAndSubmit();
    expect(screen.getByRole('alert')).toHaveTextContent(messages.login.failures.network);
    expect(email()).not.toBeDisabled();
  });
});

describe('login: failure handling', () => {
  it('clears the rejected password, keeps the email, and returns focus to the password field', async () => {
    fail();
    render(<LoginScreen />);
    await fillAndSubmit('marcus@example.com', 'wrong-password-1');
    expect(password()).toHaveValue('');
    expect(email()).toHaveValue('marcus@example.com');
    expect(password()).toHaveFocus();
  });

  it('gives the same message for an unknown account and a wrong password (no account enumeration)', async () => {
    // The mock provider behaves like a server: both cases come back as the same reason.
    const realSignIn = auth().signIn.bind(auth());
    vi.spyOn(auth(), 'signIn').mockImplementation(realSignIn);
    const { unmount } = render(<LoginScreen />);
    const a = (async () => {
      type(messages.login.email, 'nobody@example.com');
      type(messages.login.password, 'whatever-123456');
      await act(async () => {
        fireEvent.submit(form());
        await vi.advanceTimersByTimeAsync(500);
      });
      return screen.getByRole('alert').textContent;
    })();
    const first = await a;
    unmount();
    resetThrottles();
    render(<LoginScreen />);
    type(messages.login.email, 'technician@olannah.test');
    type(messages.login.password, 'wrong-password-1');
    await act(async () => {
      fireEvent.submit(form());
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByRole('alert').textContent).toBe(first);
    expect(first).toBe(messages.login.failures.invalid_credentials);
  });

  it.each([
    ['locked', messages.login.failures.locked],
    ['unavailable', messages.login.failures.unavailable],
    ['network', messages.login.failures.network],
    ['rate_limited', messages.login.failures.rate_limited],
  ] as const)('shows the plain-language message for %s and never a code', async (reason, text) => {
    fail(reason);
    render(<LoginScreen />);
    await fillAndSubmit();
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(document.body.textContent).not.toMatch(/invalid_credentials|rate_limited|unavailable_|ER-\d/);
  });
});

describe('login: attempt throttle', () => {
  it('after five failures the next failure starts a cooldown: submit is disabled with a live countdown, and does nothing', async () => {
    const spy = fail();
    render(<LoginScreen />);
    for (let i = 0; i < 6; i++) await fillAndSubmit();
    expect(spy).toHaveBeenCalledTimes(6);
    expect(screen.getByText(messages.login.throttled(30))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    await act(async () => void fireEvent.submit(form()));
    expect(spy).toHaveBeenCalledTimes(6);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText(messages.login.throttled(20))).toBeInTheDocument();
  });

  it('re-enables the form when the cooldown ends', async () => {
    fail();
    render(<LoginScreen />);
    for (let i = 0; i < 6; i++) await fillAndSubmit();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(screen.queryByText(/Too many attempts/)).toBeNull();
    expect(submitButton()).not.toBeDisabled();
  });

  it('a success clears the failure count', async () => {
    const spy = fail();
    render(<LoginScreen />);
    for (let i = 0; i < 4; i++) await fillAndSubmit();
    spy.mockResolvedValue({ ok: true });
    await fillAndSubmit();
    expect(replace).toHaveBeenCalledWith('/');
  });
});

describe('login: no secrets leak', () => {
  it('never puts the password in telemetry, the DOM text, or the URL, even after a failure', async () => {
    fail();
    render(<LoginScreen />);
    await fillAndSubmit('marcus@example.com', 'Sup3r-Secret-Value!');
    const serialized = JSON.stringify(getBufferedEvents());
    expect(serialized).not.toContain('Sup3r-Secret-Value!');
    expect(serialized).not.toContain('marcus@example.com');
    expect(document.body.textContent).not.toContain('Sup3r-Secret-Value!');
    expect(window.location.href).not.toContain('Sup3r');
    expect(getBufferedEvents().map((e) => e.event)).toContain('auth.sign_in_failed');
  });

  it('keeps the password out of browser storage', async () => {
    fail();
    render(<LoginScreen />);
    await fillAndSubmit('marcus@example.com', 'Sup3r-Secret-Value!');
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < store.length; i++) expect(store.getItem(store.key(i)!)).not.toContain('Sup3r-Secret-Value!');
    }
  });
});

describe('login: redirects', () => {
  it('shows the session-ended notice only for the exact expired reason', () => {
    search = 'reason=expired';
    const { unmount } = render(<LoginScreen />);
    expect(screen.getByText(messages.login.expiredNotice)).toBeInTheDocument();
    unmount();
    search = 'reason=<script>alert(1)</script>';
    render(<LoginScreen />);
    expect(screen.queryByText(messages.login.expiredNotice)).toBeNull();
    expect(document.body.innerHTML).not.toContain('<script>');
  });

  it('only ever redirects to the fixed destination, ignoring any redirect-style query parameter (no open redirect)', async () => {
    search = 'next=https://evil.example&redirect=//evil.example&returnTo=/admin';
    vi.spyOn(auth(), 'signIn').mockResolvedValue({ ok: true });
    render(<LoginScreen />);
    await fillAndSubmit();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('links to sign up', () => {
    render(<LoginScreen />);
    expect(screen.getByRole('link', { name: messages.login.signUpLink })).toHaveAttribute('href', '/signup');
  });
});
