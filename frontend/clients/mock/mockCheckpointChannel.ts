import type { CheckpointChannel, CheckpointListener } from '../checkpoint/checkpointChannel';
import type { AuditStub, DecisionAck, DecisionEvent } from '@/contracts';
import { validDiff, validTrigger } from '@/contracts/fixtures/checkpoint';

export type MockSubmitMode = 'ok' | 'fail' | 'mismatch' | 'mutation';
export type MockDiffMode = 'ok' | 'slow' | 'never' | 'malformed' | 'error';

// DEVELOPMENT ONLY: a mock upstream for the checkpoint (SDD 12.5). The dev overlay raises triggers and injects every failure the
// protocol must survive, so each terminal state can be seen by hand without a backend.
export const mockCheckpointControl = {
  listener: null as CheckpointListener | null,
  diffMode: 'ok' as MockDiffMode,
  submitMode: 'ok' as MockSubmitMode,
  validateValid: true,
  validateHangs: false,
  /** What the "server" received. */
  decisions: [] as DecisionEvent[],
  audits: [] as AuditStub[],
  counter: 0,

  raise(overrides: Partial<typeof validTrigger> = {}): string {
    const checkpointId = `cp-48213-${++this.counter}`;
    this.listener?.trigger({ ...validTrigger, checkpointId, ...overrides });
    return checkpointId;
  },
  raiseRaw(raw: unknown): void {
    this.listener?.trigger(raw);
  },
  upstreamChange(checkpointId: string): void {
    this.listener?.upstreamChange(checkpointId);
  },
  reset(): void {
    this.diffMode = 'ok';
    this.submitMode = 'ok';
    this.validateValid = true;
    this.validateHangs = false;
    this.decisions = [];
    this.audits = [];
  },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const seen = new Set<string>();

export class MockCheckpointChannel implements CheckpointChannel {
  subscribe(listener: CheckpointListener): () => void {
    mockCheckpointControl.listener = listener;
    return () => {
      if (mockCheckpointControl.listener === listener) mockCheckpointControl.listener = null;
    };
  }

  async fetchDiff(checkpointId: string): Promise<unknown> {
    const mode = mockCheckpointControl.diffMode;
    if (mode === 'never') return new Promise(() => {});
    if (mode === 'error') throw new Error('diff unavailable');
    await wait(mode === 'slow' ? 1500 : 150);
    if (mode === 'malformed') return { schemaVersion: '1.0', checkpointId, fields: [] };
    return { ...validDiff, checkpointId };
  }

  async submitDecision(event: DecisionEvent): Promise<DecisionAck> {
    await wait(300);
    const mode = mockCheckpointControl.submitMode;
    if (mode === 'fail') throw new Error('bus unavailable');
    if (mode === 'mismatch') return { status: 'payload_mismatch' };
    if (mode === 'mutation') return { status: 'upstream_mutation' };
    // Idempotent on the event id: a retry is acknowledged and never recorded twice.
    if (!seen.has(event.eventId)) {
      seen.add(event.eventId);
      mockCheckpointControl.decisions.push(event);
    }
    return { status: 'acknowledged' };
  }

  async submitAudit(stub: AuditStub): Promise<void> {
    mockCheckpointControl.audits.push(stub);
  }

  async validate(checkpointId: string): Promise<unknown> {
    if (mockCheckpointControl.validateHangs) return new Promise(() => {});
    await wait(200);
    return { checkpointId, valid: mockCheckpointControl.validateValid };
  }
}
