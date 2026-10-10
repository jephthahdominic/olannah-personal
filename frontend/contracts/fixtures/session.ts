import type { SessionConfirmation } from '../session';

export const technicianSession: SessionConfirmation = {
  userId: 'user-tech-001',
  resolvedRole: 'technician',
  tenantId: 'tenant-demo',
  sessionToken: 'mock-token-technician',
  sessionId: 'session-mock-001',
};

export const estimatorSession: SessionConfirmation = {
  userId: 'user-est-001',
  resolvedRole: 'estimator',
  tenantId: 'tenant-demo',
  sessionToken: 'mock-token-estimator',
  sessionId: 'session-mock-002',
};
