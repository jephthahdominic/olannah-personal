import type { AuthProvider } from '@/clients/auth/authProvider';
import type { ContextChannel } from '@/clients/context/contextChannel';
import type { SessionClient, SessionIdentity } from '@/clients/session/sessionClient';
import { DEFAULT_RUNTIME_CONFIG, type RuntimeConfig } from '@/contracts';
import { initialBootState, reduceBoot, type BootEvent, type BootState } from './bootMachine';
import { purgeSession, registerPurgeHandler } from '../purgeSession';
import { logEvent } from '../telemetry';

export interface BootDeps {
  auth: AuthProvider;
  context: ContextChannel;
  sessionClient: SessionClient;
  config?: RuntimeConfig;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Drives the boot machine: owns timers and async work, and feeds events to the pure reducer.
 * Framework-free so the whole boot sequence is testable with fake timers, no browser needed.
 */
export class BootController {
  #state: BootState = initialBootState;
  #listeners = new Set<() => void>();
  #config: RuntimeConfig;
  #timers = new Set<Timer>();
  #attempt = 0;
  #disposed = false;
  #unregisterPurge: (() => void) | null = null;
  #unsubscribeExpiry: (() => void) | null = null;

  constructor(private readonly deps: BootDeps) {
    this.#config = deps.config ?? DEFAULT_RUNTIME_CONFIG;
  }

  // Arrow properties so they can be passed straight to useSyncExternalStore.
  getState = (): BootState => this.#state;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  start(): void {
    this.#unregisterPurge = registerPurgeHandler(() => this.#teardown());
    this.#timer(() => this.#dispatch({ type: 'SESSION_SLOW' }), this.#config.session.slowMessageAfterMs);

    this.deps.auth.restoreSession().then(
      (session) => {
        if (this.#disposed || this.#state.phase !== 'awaitingSession') return;
        if (!session) return this.#dispatch({ type: 'NO_SESSION' });
        // The token goes into the session client only. The store gets an identity with no token.
        const identity = this.deps.sessionClient.set(session);
        this.#unsubscribeExpiry = this.deps.auth.onSessionExpired(() => this.sessionExpired());
        this.#dispatch({ type: 'SESSION_CONFIRMED', session: identity });
        this.#requestContext(identity);
      },
      // A failed SSO restore means the worker has to sign in again.
      () => !this.#disposed && this.#dispatch({ type: 'NO_SESSION' }),
    );
  }

  /** Retry from the recovery screens: re-request delivery on the context channel. */
  retry(): void {
    const phase = this.#state.phase;
    if (
      phase !== 'contextHardTimeout' &&
      phase !== 'fallbackSchema' &&
      phase !== 'fallbackMalformed' &&
      phase !== 'fallbackUnknownRole'
    ) {
      return;
    }
    const session = this.#state.session;
    this.#dispatch({ type: 'RETRY' });
    this.#requestContext(session);
  }

  /** Called when the SSO flow reports expiry. Shows the expired screen, then purges everything. */
  sessionExpired(): void {
    this.#dispatch({ type: 'SESSION_EXPIRED' });
    void purgeSession();
  }

  dispose(): void {
    this.#teardown();
    this.#unregisterPurge?.();
    this.#unregisterPurge = null;
    this.#listeners.clear();
  }

  #requestContext(session: SessionIdentity): void {
    this.#clearTimers();
    const attempt = ++this.#attempt;
    const { deliveryBudgetMs, hardTimeoutMs } = this.#config.context;

    this.#timer(() => this.#dispatch({ type: 'DELIVERY_BUDGET_EXCEEDED' }), deliveryBudgetMs);
    this.#timer(() => this.#dispatch({ type: 'HARD_TIMEOUT' }), hardTimeoutMs);

    this.deps.context.request(session).then(
      (raw) => {
        // Ignore a late answer to a superseded request, or one that arrives after the recovery screen is showing.
        if (this.#disposed || attempt !== this.#attempt) return;
        const before = this.#state.phase;
        if (before !== 'awaitingContext' && before !== 'contextDegraded') return;
        this.#clearTimers();
        this.#dispatch({ type: 'CONTEXT_RECEIVED', raw });
        // Stage 2 will gate this on the first zone render. With no zones yet, assembled is settled.
        if (this.getState().phase === 'assembled') this.#dispatch({ type: 'CONTEXT_SETTLED' });
      },
      // A rejected request leaves the worker in the waiting states, which end at the degraded and recovery
      // screens. It never throws into the UI.
      () => {},
    );
  }

  #dispatch(event: BootEvent): void {
    if (this.#disposed) return;
    const { state, log } = reduceBoot(this.#state, event);
    for (const entry of log) logEvent(entry.event, entry.severity, entry.detail);
    if (state === this.#state) return;
    this.#state = state;
    for (const listener of [...this.#listeners]) listener();
  }

  #timer(fn: () => void, ms: number): void {
    const handle = setTimeout(() => {
      this.#timers.delete(handle);
      fn();
    }, ms);
    this.#timers.add(handle);
  }

  #clearTimers(): void {
    for (const handle of this.#timers) clearTimeout(handle);
    this.#timers.clear();
  }

  // Registered with purgeSession(): cancel timers and drop the token. Final state is left to the caller.
  #teardown(): void {
    this.#clearTimers();
    this.#unsubscribeExpiry?.();
    this.#unsubscribeExpiry = null;
    this.deps.sessionClient.clear();
    this.#disposed = true;
  }
}
