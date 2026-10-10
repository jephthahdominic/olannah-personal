'use client';

import { useSyncExternalStore } from 'react';
import type { FeedbackStatus, FeedbackSubmitter } from './feedbackSubmitter';

export function useFeedbackStatus(submitter: FeedbackSubmitter): FeedbackStatus {
  return useSyncExternalStore(submitter.subscribe, submitter.getSnapshot, () => 'idle' as const);
}
