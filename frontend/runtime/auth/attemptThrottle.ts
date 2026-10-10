// Client-side attempt throttle. This is a USABILITY and defence-in-depth measure only: a determined attacker bypasses
// the browser entirely, so the server MUST rate limit and lock out. It stops accidental hammering, slows casual abuse,
// and gives the worker a clear "try again in N seconds" instead of a confusing failure.
// In memory only, so a reload resets it (nothing is written to browser storage, ADR-010).

export interface ThrottleOptions {
  /** Failures allowed before the first cooldown. */
  freeAttempts: number;
  baseCooldownMs: number;
  maxCooldownMs: number;
  now?: () => number;
}

export const DEFAULT_THROTTLE: ThrottleOptions = { freeAttempts: 5, baseCooldownMs: 30_000, maxCooldownMs: 300_000 };

export class AttemptThrottle {
  #failures = 0;
  #lockedUntil = 0;
  readonly #opts: ThrottleOptions;

  constructor(opts: Partial<ThrottleOptions> = {}) {
    this.#opts = { ...DEFAULT_THROTTLE, ...opts };
  }

  #now(): number {
    return (this.#opts.now ?? Date.now)();
  }

  /** Milliseconds until another attempt is allowed. 0 when allowed. */
  remainingMs(): number {
    return Math.max(0, this.#lockedUntil - this.#now());
  }

  isLocked(): boolean {
    return this.remainingMs() > 0;
  }

  /** Records a failed attempt. Each failure past the free allowance doubles the cooldown, up to the maximum. */
  recordFailure(): void {
    this.#failures += 1;
    const over = this.#failures - this.#opts.freeAttempts;
    if (over < 1) return;
    const cooldown = Math.min(this.#opts.baseCooldownMs * 2 ** (over - 1), this.#opts.maxCooldownMs);
    this.#lockedUntil = this.#now() + cooldown;
  }

  recordSuccess(): void {
    this.#failures = 0;
    this.#lockedUntil = 0;
  }

  /** Failures recorded since the last success. For tests and for deciding what to say, never for display of secrets. */
  get failures(): number {
    return this.#failures;
  }
}
