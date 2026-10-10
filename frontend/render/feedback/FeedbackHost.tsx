'use client';

import { useState } from 'react';
import { FeedbackForm } from '@/components';
import { FEEDBACK_MAX_LENGTH, type FeedbackErrorCode, type ScreenContext } from '@/contracts';
import type { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import { useFeedbackStatus } from '@/runtime/feedback/useFeedbackStatus';
import { messages } from '../messages';

// The composing layer for feedback (BRD 1.2 5.10 Feature 7): it owns the draft, captures the screen context AUTOMATICALLY, and
// supplies the submission state. The worker never describes the screen. An unsent draft is kept if the form is dismissed.
export function FeedbackHost({
  runtime,
  open,
  onDismiss,
  presentation,
  screen,
  screenSummary,
  portalTarget,
}: {
  runtime: CanvasRuntime;
  open: boolean;
  onDismiss: () => void;
  presentation: 'popover' | 'sheet';
  screen: ScreenContext;
  screenSummary: string;
  portalTarget: HTMLElement | null;
}) {
  const status = useFeedbackStatus(runtime.feedback);
  const [draft, setDraft] = useState('');
  const [code, setCode] = useState<FeedbackErrorCode | null>(null);

  async function submit() {
    setCode(null);
    const result = await runtime.feedback.submit(draft, screen);
    if (!result.ok && result.reason === 'invalid') setCode(result.code);
  }

  function dismiss() {
    // After a successful send the form starts blank next time. An unsent or failed draft is kept.
    if (status === 'succeeded') {
      setDraft('');
      runtime.feedback.reset();
    }
    setCode(null);
    onDismiss();
  }

  return (
    <FeedbackForm
      open={open}
      presentation={presentation}
      screenSummary={screenSummary}
      draft={draft}
      onDraftChange={(d) => {
        setDraft(d);
        setCode(null);
      }}
      status={status}
      validationMessage={code ? messages.feedback.validation[code] : undefined}
      maxLength={FEEDBACK_MAX_LENGTH}
      onSubmit={() => void submit()}
      onDismiss={dismiss}
      labels={messages.feedback}
      portalTarget={portalTarget}
    />
  );
}
