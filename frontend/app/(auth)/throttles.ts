import { AttemptThrottle } from '@/runtime/auth/attemptThrottle';

// One throttle per form, shared across remounts so navigating between sign in and sign up does not reset it.
// In memory only: a reload resets it, which is why the server MUST enforce its own limits.
export let loginThrottle = new AttemptThrottle();
export let signupThrottle = new AttemptThrottle();

export function resetThrottles(): void {
  loginThrottle = new AttemptThrottle();
  signupThrottle = new AttemptThrottle();
}
