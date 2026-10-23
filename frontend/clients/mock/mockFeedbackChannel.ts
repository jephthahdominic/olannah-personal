import type { FeedbackChannel } from '../feedback/feedbackChannel';
import type { FeedbackSubmission } from '@/contracts';
import { mockControls } from './mockControls';

export class MockFeedbackChannel implements FeedbackChannel {
  /** Everything the mock "server" accepted, keyed by idempotency key (a duplicate key is acknowledged, never stored twice). */
  readonly received = new Map<string, FeedbackSubmission>();

  async submit(submission: FeedbackSubmission): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 400));
    if (mockControls.feedbackFails) throw new Error('feedback unavailable');
    if (!this.received.has(submission.idempotencyKey)) this.received.set(submission.idempotencyKey, submission);
    return true;
  }
}
