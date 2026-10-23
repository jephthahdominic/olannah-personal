// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAuthProvider } from './mockAuthProvider';
import { MOCK_PASSWORD, MOCK_LOCKED_EMAIL, MOCK_DOWN_EMAIL } from './mockUsers';
import { setFaults, NO_FAULTS } from './mockIdp';
import { MockContextChannel } from './mockContextChannel';

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  setFaults(NO_FAULTS);
});
afterEach(() => vi.useRealTimers());

async function signIn(auth: MockAuthProvider, email: string, password: string) {
  const pending = auth.signIn({ email, password });
  await vi.advanceTimersByTimeAsync(500);
  return pending;
}

describe('MockAuthProvider', () => {
  it('signs in a known account and restores the session after a reload (the IdP stays signed in)', async () => {
    const auth = new MockAuthProvider();
    expect(await signIn(auth, 'technician@olannah.test', MOCK_PASSWORD)).toEqual({ ok: true });
    const restore = auth.restoreSession();
    await vi.advanceTimersByTimeAsync(100);
    expect((await restore)?.resolvedRole).toBe('technician');
  });

  it('returns null when nobody is signed in', async () => {
    const restore = new MockAuthProvider().restoreSession();
    await vi.advanceTimersByTimeAsync(100);
    expect(await restore).toBeNull();
  });

  it.each([
    ['technician@olannah.test', 'wrong', 'invalid_credentials'],
    ['nobody@olannah.test', MOCK_PASSWORD, 'invalid_credentials'],
    [MOCK_LOCKED_EMAIL, MOCK_PASSWORD, 'locked'],
    [MOCK_DOWN_EMAIL, MOCK_PASSWORD, 'unavailable'],
  ])('reports %s as %s', async (email, password, reason) => {
    expect(await signIn(new MockAuthProvider(), email, password)).toEqual({ ok: false, reason });
  });

  it('never resolves restoreSession when the session confirmation is set to never arrive', async () => {
    setFaults({ sessionNeverArrives: true });
    let settled = false;
    void new MockAuthProvider().restoreSession().then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(settled).toBe(false);
  });

  it('signs out by ending the IdP session', async () => {
    const auth = new MockAuthProvider();
    await signIn(auth, 'estimator@olannah.test', MOCK_PASSWORD);
    await auth.signOut();
    const restore = auth.restoreSession();
    await vi.advanceTimersByTimeAsync(100);
    expect(await restore).toBeNull();
  });

  it('notifies listeners when the session expires after the configured delay', async () => {
    const auth = new MockAuthProvider();
    await signIn(auth, 'technician@olannah.test', MOCK_PASSWORD);
    setFaults({ sessionExpiresAfterMs: 5000 });
    const onExpired = vi.fn();
    auth.onSessionExpired(onExpired);
    const restore = auth.restoreSession();
    await vi.advanceTimersByTimeAsync(100);
    await restore;
    await vi.advanceTimersByTimeAsync(5000);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});

describe('MockContextChannel', () => {
  it('delivers a fresh object each time, so a delivery can never be shared state', async () => {
    const channel = new MockContextChannel();
    const a = await channel.request();
    const b = await channel.request();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
