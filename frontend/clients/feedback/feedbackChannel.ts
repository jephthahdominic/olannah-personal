import type { FeedbackSubmission } from '@/contracts';

// Feedback goes out as an HTTPS request that returns an acknowledgment, carrying a client-generated idempotency key so a
// retry can never create a duplicate (SDD ADR-004). The endpoint is OPEN (SDD K17). Resolves true only on acknowledgment.
export interface FeedbackChannel {
  submit(submission: FeedbackSubmission): Promise<boolean>;
}
