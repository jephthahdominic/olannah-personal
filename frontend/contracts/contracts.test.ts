import { describe, it, expect } from 'vitest';
import { SessionConfirmationSchema } from './index';
import { technicianSession, estimatorSession } from './fixtures/session';

// The context and history contracts are tested in contracts/wire/wire.test.ts, against the practice API's own responses.

describe('session contract', () => {
  it('accepts valid session fixtures', () => {
    expect(SessionConfirmationSchema.safeParse(technicianSession).success).toBe(true);
    expect(SessionConfirmationSchema.safeParse(estimatorSession).success).toBe(true);
  });

  it('accepts a null resolved role (role may only arrive in the context object)', () => {
    expect(SessionConfirmationSchema.safeParse({ ...technicianSession, resolvedRole: null }).success).toBe(true);
  });

  it('rejects a session with no token', () => {
    expect(SessionConfirmationSchema.safeParse({ ...technicianSession, sessionToken: '' }).success).toBe(false);
  });
});
