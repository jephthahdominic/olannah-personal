import type { CheckpointTrigger, DiffPayload } from '../checkpoint';

// Fixtures (valid, unknown-version, malformed) for the draft checkpoint contracts. Freezer scenario: WO-48213, FZ-02.
export const validTrigger: CheckpointTrigger = {
  schemaVersion: '1.0',
  checkpointId: 'cp-48213-1',
  triggeredBy: 'Close-out workflow',
  description: 'Closing WO-48213 will update the work order and the equipment service history.',
};
export const unknownVersionTrigger = { ...validTrigger, schemaVersion: '9.0' };
export const malformedTrigger = { schemaVersion: '1.0', checkpointId: 42 };

export const validDiff: DiffPayload = {
  schemaVersion: '1.0',
  checkpointId: 'cp-48213-1',
  targetSystem: 'Service records',
  recordId: 'WO-48213',
  originatingAgent: 'Close-out workflow',
  fields: [
    { id: 'status', label: 'Work order status', current: 'In progress', proposed: 'Ready for review' },
    { id: 'part', label: 'Part replaced', current: null, proposed: 'DTS-44 defrost sensor' },
    { id: 'resolution', label: 'Resolution note', current: 'Not recorded', proposed: 'Replaced the defrost sensor; recovery confirmed.' },
  ],
  payloadReference: 'ref-7f3a9c',
};
export const mismatchedDiff: DiffPayload = { ...validDiff, checkpointId: 'cp-other' };
export const malformedDiff = { schemaVersion: '1.0', checkpointId: 'cp-48213-1', fields: [] };
