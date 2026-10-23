import type { SessionConfirmation, SignUpRequest } from '@/contracts';

// The shell does not authenticate (BRD 1.0 section 4). Authentication is Identity and Access's SSO flow, which
// delivers a session confirmation event. This interface is the seam: the mock provider and the real SSO provider
// are interchangeable, so no screen changes when the real backend lands.

export interface Credentials {
  email: string;
  password: string;
}

/** Reason codes only. Worker-facing text lives in the message catalogue; codes are never shown to the worker. */
export type AuthFailureReason = 'invalid_credentials' | 'locked' | 'unavailable' | 'network' | 'rate_limited';

export type SignInResult = { ok: true } | { ok: false; reason: AuthFailureReason };

// Sign up must NOT reveal whether an email is already registered (account enumeration). A successful result therefore
// means only "if this address can be registered, a verification message has been sent". A role is never chosen by the
// worker: it is resolved upstream after verification.
export type SignUpFailureReason = 'unavailable' | 'network' | 'rate_limited' | 'rejected';
export type SignUpResult = { ok: true } | { ok: false; reason: SignUpFailureReason };

export interface AuthProvider {
  signIn(credentials: Credentials): Promise<SignInResult>;
  signUp(request: SignUpRequest): Promise<SignUpResult>;
  /**
   * Resolves with the session confirmation if the SSO session is live, or null if the worker must sign in.
   * May stay pending (confirmation never arrives): callers must hold their loading state, not time out to an error.
   */
  restoreSession(): Promise<SessionConfirmation | null>;
  /** Subscribes to session expiry. Returns an unsubscribe function. */
  onSessionExpired(callback: () => void): () => void;
  signOut(): Promise<void>;
}
