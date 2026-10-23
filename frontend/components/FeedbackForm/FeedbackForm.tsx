'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { InlineError } from '../InlineError/InlineError';
import { Label } from '../Label/Label';
import { TextArea } from '../TextArea/TextArea';
import { useFocusReturn } from '../utils/useFocusReturn';
import { focusFirst, useFocusTrap } from '../utils/useFocusTrap';
import styles from './FeedbackForm.module.css';

export interface FeedbackLabels {
  title: string;
  /** "About" line label. */
  aboutLabel: string;
  fieldLabel: string;
  submit: string;
  submitting: string;
  close: string;
  doneTitle: string;
  doneBody: string;
  doneClose: string;
  failedTitle: string;
  failedBody: string;
  retry: string;
}

export interface FeedbackFormProps {
  open: boolean;
  /** A popover on tablet and desktop, a bottom sheet on mobile (BRD 1.3 section 6.7). */
  presentation: 'popover' | 'sheet';
  /** The screen the feedback is about, captured AUTOMATICALLY and shown read-only: the worker never describes it. */
  screenSummary: string;
  /** Controlled draft, owned by the composing layer. */
  draft: string;
  onDraftChange: (draft: string) => void;
  /** Submission state is SUPPLIED. The form never decides success or failure itself (BRD 1.2 5.10 Feature 7). */
  status: 'idle' | 'submitting' | 'succeeded' | 'failed';
  /** Supplied validation text for the field, if any. */
  validationMessage?: string;
  maxLength: number;
  onSubmit: () => void;
  onDismiss: () => void;
  labels: FeedbackLabels;
  portalTarget?: HTMLElement | null;
}

// Contextual feedback: always about the current screen and view, with that context captured automatically, so reporting a
// problem takes one step, not a paragraph (BRD 1.3 section 6.7). The draft is owned by the composing layer.
export function FeedbackForm(p: FeedbackFormProps) {
  const root = useRef<HTMLDivElement>(null);
  const onKeyDown = useFocusTrap(root, p.onDismiss);
  useFocusReturn(p.open);

  // Move focus into the form when it opens, and again when it changes to the success view (the old focus target is gone).
  const succeeded = p.status === 'succeeded';
  useEffect(() => {
    if (p.open) focusFirst(root.current);
  }, [p.open, succeeded]);

  if (!p.open) return null;

  const busy = p.status === 'submitting';
  const body =
    p.status === 'succeeded' ? (
      <div className={styles.done} role="status">
        <p className="type-heading-md">{p.labels.doneTitle}</p>
        <p className="type-body">{p.labels.doneBody}</p>
        <Button label={p.labels.doneClose} onActivate={p.onDismiss} />
      </div>
    ) : (
      <form
        className={styles.form}
        noValidate
        aria-busy={busy || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) p.onSubmit();
        }}
      >
        <p className={`${styles.about} type-body-sm`}>
          <Label text={p.labels.aboutLabel} /> <span>{p.screenSummary}</span>
        </p>
        {p.status === 'failed' && <InlineError title={p.labels.failedTitle} body={p.labels.failedBody} />}
        <FormField id="feedback-text" label={p.labels.fieldLabel} validationMessage={p.validationMessage}>
          <TextArea
            id="feedback-text"
            name="feedback"
            rows={5}
            maxLength={p.maxLength}
            value={p.draft}
            onChange={p.onDraftChange}
            invalid={!!p.validationMessage}
            describedBy={p.validationMessage ? 'feedback-text-message' : undefined}
            disabled={busy}
          />
        </FormField>
        <Button
          type="submit"
          label={p.status === 'failed' ? p.labels.retry : p.labels.submit}
          processing={busy}
          processingLabel={p.labels.submitting}
          fullWidth
        />
      </form>
    );

  const content = (
    <div className={`${styles.root} ${p.presentation === 'sheet' ? styles.sheetRoot : ''}`} onKeyDown={onKeyDown}>
      {p.presentation === 'sheet' && <div className={styles.overlay} onClick={p.onDismiss} aria-hidden="true" data-testid="feedback-overlay" />}
      <div ref={root} className={`${styles.panel} ${p.presentation === 'sheet' ? styles.sheet : styles.popover}`} role="dialog" aria-label={p.labels.title} aria-modal={p.presentation === 'sheet' || undefined}>
        <div className={styles.header}>
          <span className="type-heading-md">{p.labels.title}</span>
          <button type="button" className={styles.close} aria-label={p.labels.close} onClick={p.onDismiss}>
            <Icon name="x" size="md" />
          </button>
        </div>
        <div className={styles.body}>{body}</div>
      </div>
    </div>
  );
  return p.portalTarget ? createPortal(content, p.portalTarget) : content;
}
