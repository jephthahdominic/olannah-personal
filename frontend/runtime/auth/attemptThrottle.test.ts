import { describe, it, expect } from 'vitest';
import { AttemptThrottle } from './attemptThrottle';

const clock = () => {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
};

describe('AttemptThrottle', () => {
  it('allows the free attempts without a cooldown', () => {
    const c = clock();
    const t = new AttemptThrottle({ now: c.now });
    for (let i = 0; i < 5; i++) t.recordFailure();
    expect(t.isLocked()).toBe(false);
  });

  it('locks after the free attempts are used, for the base cooldown', () => {
    const c = clock();
    const t = new AttemptThrottle({ now: c.now });
    for (let i = 0; i < 6; i++) t.recordFailure();
    expect(t.isLocked()).toBe(true);
    expect(t.remainingMs()).toBe(30_000);
    c.advance(29_999);
    expect(t.isLocked()).toBe(true);
    c.advance(2);
    expect(t.isLocked()).toBe(false);
  });

  it('doubles the cooldown with each further failure, up to the maximum', () => {
    const c = clock();
    const t = new AttemptThrottle({ now: c.now });
    for (let i = 0; i < 6; i++) t.recordFailure();
    c.advance(30_001);
    t.recordFailure();
    expect(t.remainingMs()).toBe(60_000);
    c.advance(60_001);
    t.recordFailure();
    expect(t.remainingMs()).toBe(120_000);
    for (let i = 0; i < 10; i++) {
      c.advance(300_001);
      t.recordFailure();
    }
    expect(t.remainingMs()).toBe(300_000);
  });

  it('a success clears the failures and the lock', () => {
    const c = clock();
    const t = new AttemptThrottle({ now: c.now });
    for (let i = 0; i < 8; i++) t.recordFailure();
    t.recordSuccess();
    expect(t.isLocked()).toBe(false);
    expect(t.failures).toBe(0);
  });
});
