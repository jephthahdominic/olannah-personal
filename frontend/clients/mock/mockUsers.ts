import type { SessionConfirmation } from '@/contracts';
import type { ContextEnvelope } from '@/contracts';
import { technicianSession, estimatorSession } from '@/contracts/fixtures/session';
import {
  technicianContext,
  estimatorContext,
  unmappedRoleContext,
  undeterminedRoleContext,
} from '@/contracts/fixtures/context';
import type { MockPersona } from './mockIdp';

// Mock accounts. Password for every account is "olannah". These exist only in mock mode.
export const MOCK_PASSWORD = 'olannah';

export const MOCK_ACCOUNTS: Record<string, MockPersona> = {
  'technician@olannah.test': 'technician',
  'estimator@olannah.test': 'estimator',
  // Holds more than one role assignment; the PRIMARY one (technician) decides the layout, never a hybrid.
  'multirole@olannah.test': 'multirole',
  // Role is known but no layout is registered for it.
  'unmapped@olannah.test': 'unmapped',
  // Role cannot be determined at all.
  'norole@olannah.test': 'norole',
};

/** Accounts that exercise sign-in failure paths. */
export const MOCK_LOCKED_EMAIL = 'locked@olannah.test';
export const MOCK_DOWN_EMAIL = 'down@olannah.test';

export function sessionFor(persona: MockPersona): SessionConfirmation {
  switch (persona) {
    case 'technician':
      return technicianSession;
    case 'estimator':
      return estimatorSession;
    case 'multirole':
      return { ...technicianSession, userId: 'user-multi-001', sessionToken: 'mock-token-multirole' };
    case 'unmapped':
      return { ...technicianSession, userId: 'user-unmapped-001', resolvedRole: 'dispatcher', sessionToken: 'mock-token-unmapped' };
    case 'norole':
      return { ...technicianSession, userId: 'user-norole-001', resolvedRole: null, sessionToken: 'mock-token-norole' };
  }
}

export function contextFor(persona: MockPersona): ContextEnvelope {
  switch (persona) {
    case 'technician':
      return technicianContext;
    case 'estimator':
      return estimatorContext;
    case 'multirole':
      return { ...technicianContext, persona: { roles: ['technician', 'estimator'], primaryRole: 'technician' } };
    case 'unmapped':
      return unmappedRoleContext;
    case 'norole':
      return undeterminedRoleContext;
  }
}
