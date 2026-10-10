import type { AuthProvider, SignInResult, SignUpResult } from '../auth/authProvider';
import type { SessionConfirmation } from '@/contracts';

// Placeholder for the real SSO integration. The backend is not ready and the session confirmation format is OPEN
// (BRD 1.0 OQ2). Until it exists this provider reports the service as unavailable, which the login screen renders as
// a plain-language message with a retry. Replace the bodies; nothing that calls this interface should change.
export class RealAuthProvider implements AuthProvider {
  async signIn(): Promise<SignInResult> {
    return { ok: false, reason: 'unavailable' };
  }
  async signUp(): Promise<SignUpResult> {
    return { ok: false, reason: 'unavailable' };
  }
  async restoreSession(): Promise<SessionConfirmation | null> {
    return null;
  }
  onSessionExpired(): () => void {
    return () => {};
  }
  async signOut(): Promise<void> {}
}
