import type { SessionConfirmation } from '@/contracts';

// The single holder of the session token (SDD 15.2). Memory only: never in URLs, storage or logs, and never exposed
// to the render path or the store. Runtime clients ask it to attach the session to their requests.

/** What the rest of the app may know about the worker. Deliberately has no token. */
export interface SessionIdentity {
  userId: string;
  tenantId: string;
  resolvedRole: string | null;
  sessionId?: string;
}

export class SessionClient {
  #token: string | null = null;

  set(session: SessionConfirmation): SessionIdentity {
    this.#token = session.sessionToken;
    return {
      userId: session.userId,
      tenantId: session.tenantId,
      resolvedRole: session.resolvedRole,
      ...(session.sessionId ? { sessionId: session.sessionId } : {}),
    };
  }

  clear(): void {
    this.#token = null;
  }

  hasSession(): boolean {
    return this.#token !== null;
  }

  /** For runtime clients only. Adds the session to an outgoing request. */
  attach(init: RequestInit = {}): RequestInit {
    if (this.#token === null) return init;
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.#token}`);
    return { ...init, headers };
  }
}

export const sessionClient = new SessionClient();
