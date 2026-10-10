import { z } from 'zod';

// DRAFT. Feedback is always contextual to the current screen, and the context is captured AUTOMATICALLY (BRD 1.3 section 6.7,
// Assumption 14). It is structured data, never a screenshot, so sensitive content on screen is not captured (SDD 15.3).
// The submission endpoint is OPEN (SDD K17).
export const FEEDBACK_MAX_LENGTH = 2000;

export const ScreenContextSchema = z.object({
  destinationId: z.string().nullable(),
  layoutId: z.string(),
  viewport: z.enum(['mobile', 'tablet', 'desktop']),
  /** Names of the zones and their conditions, so a report can say what the worker was looking at. No values. */
  zones: z.array(z.object({ zone: z.string(), condition: z.string() })),
});
export type ScreenContext = z.infer<typeof ScreenContextSchema>;

export const feedbackTextSchema = z
  .string()
  .trim()
  .min(1, { error: 'feedback_required' })
  .max(FEEDBACK_MAX_LENGTH, { error: 'feedback_too_long' })
  .refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), { error: 'invalid_characters' });

/** What is sent. The idempotency key is generated once per attempt and reused on retry, so a retry can never double-submit. */
export const FeedbackSubmissionSchema = z.object({
  idempotencyKey: z.string().min(8),
  text: feedbackTextSchema,
  screen: ScreenContextSchema,
});
export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;

export type FeedbackErrorCode = 'feedback_required' | 'feedback_too_long' | 'invalid_characters';
