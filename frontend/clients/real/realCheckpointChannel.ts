import type { CheckpointChannel, CheckpointListener } from '../checkpoint/checkpointChannel';

// The real checkpoint transport is OPEN: the trigger (K7) and diff (K8) contracts are not agreed and BRD 1.4 is not in the repo.
// Until they are, this channel never raises a trigger, and every call fails CLOSED: a decision cannot be submitted, so nothing is
// ever written. It exists so real mode wires up without a mock, and so the failure mode is safe rather than silent.
export class RealCheckpointChannel implements CheckpointChannel {
  subscribe(listener: CheckpointListener): () => void {
    void listener;
    return () => {};
  }
  fetchDiff(): Promise<unknown> {
    return Promise.reject(new Error('checkpoint transport is not available'));
  }
  submitDecision(): Promise<never> {
    return Promise.reject(new Error('checkpoint transport is not available'));
  }
  submitAudit(): Promise<void> {
    return Promise.reject(new Error('checkpoint transport is not available'));
  }
  validate(): Promise<unknown> {
    return Promise.reject(new Error('checkpoint transport is not available'));
  }
}
