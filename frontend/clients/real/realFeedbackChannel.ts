import type { FeedbackChannel } from '../feedback/feedbackChannel';

// Placeholder: the feedback endpoint is OPEN (SDD K17). Rejecting makes the form show its failure state with a retry.
export class RealFeedbackChannel implements FeedbackChannel {
  async submit(): Promise<boolean> {
    throw new Error('feedback transport not implemented');
  }
}
