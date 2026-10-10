import type { AuthProvider, Credentials, SignInResult, SignUpResult } from '../auth/authProvider';
import { validateSignup, type SessionConfirmation, type SignUpRequest } from '@/contracts';
import {
  clearIdpSession,
  getFaults,
  getIdpPersona,
  setIdpPersona,
} from './mockIdp';
import { MOCK_ACCOUNTS, MOCK_DOWN_EMAIL, MOCK_LOCKED_EMAIL, MOCK_PASSWORD, sessionFor } from './mockUsers';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MockAuthProvider implements AuthProvider {
  #expiryTimer: ReturnType<typeof setTimeout> | null = null;
  #expiryListeners = new Set<() => void>();

  async signIn({ email, password }: Credentials): Promise<SignInResult> {
    await wait(400);
    const key = email.trim().toLowerCase();
    if (key === MOCK_DOWN_EMAIL) return { ok: false, reason: 'unavailable' };
    if (key === MOCK_LOCKED_EMAIL) return { ok: false, reason: 'locked' };
    const persona = MOCK_ACCOUNTS[key];
    if (!persona || password !== MOCK_PASSWORD) return { ok: false, reason: 'invalid_credentials' };
    setIdpPersona(persona);
    return { ok: true };
  }

  async signUp(request: SignUpRequest): Promise<SignUpResult> {
    await wait(400);
    // A real server validates again and never trusts the browser. The mock does the same so a bypassed form is caught.
    if (!validateSignup({ ...request, confirmPassword: request.password }).ok) return { ok: false, reason: 'rejected' };
    if (request.email === MOCK_DOWN_EMAIL) return { ok: false, reason: 'unavailable' };
    // Identical result whether or not the address already exists (no account enumeration). Nothing is stored: a real
    // account would be created unverified and could not sign in until the emailed link is used.
    return { ok: true };
  }

  async restoreSession(): Promise<SessionConfirmation | null> {
    if (getFaults().sessionNeverArrives) {
      // Never resolves, by design. The boot machine must hold its loading state without crashing.
      return new Promise<never>(() => {});
    }
    await wait(50);
    const persona = getIdpPersona();
    if (!persona) return null;
    this.#armExpiry();
    return sessionFor(persona);
  }

  onSessionExpired(callback: () => void): () => void {
    this.#expiryListeners.add(callback);
    return () => this.#expiryListeners.delete(callback);
  }

  async signOut(): Promise<void> {
    this.#disarmExpiry();
    clearIdpSession();
  }

  #armExpiry(): void {
    this.#disarmExpiry();
    const after = getFaults().sessionExpiresAfterMs;
    if (after === null) return;
    this.#expiryTimer = setTimeout(() => {
      clearIdpSession();
      for (const listener of [...this.#expiryListeners]) listener();
    }, after);
  }

  #disarmExpiry(): void {
    if (this.#expiryTimer) clearTimeout(this.#expiryTimer);
    this.#expiryTimer = null;
  }
}
