import { describe, it, expect } from 'vitest';
import { validateContext, SessionConfirmationSchema } from './index';
import {
  technicianContext,
  estimatorContext,
  unmappedRoleContext,
  undeterminedRoleContext,
  unknownVersionContext,
  malformedContexts,
} from './fixtures/context';
import { technicianSession, estimatorSession } from './fixtures/session';

describe('context contract', () => {
  it.each([
    ['technician', technicianContext],
    ['estimator', estimatorContext],
    ['unmapped role', unmappedRoleContext],
    ['undetermined role', undeterminedRoleContext],
  ])('accepts the valid %s fixture', (_name, fixture) => {
    expect(validateContext(fixture).kind).toBe('ok');
  });

  it('reports an unrecognized schema version, and never throws', () => {
    expect(validateContext(unknownVersionContext)).toEqual({ kind: 'schema_mismatch', version: '99.0' });
  });

  it.each(Object.entries(malformedContexts))('treats malformed fixture "%s" as a malformed envelope', (_name, fixture) => {
    expect(validateContext(fixture).kind).toBe('envelope_malformed');
  });
});

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
