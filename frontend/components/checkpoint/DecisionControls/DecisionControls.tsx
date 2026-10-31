'use client';

import { Button } from '../../Button/Button';
import { ConfirmationGesture } from '../ConfirmationGesture/ConfirmationGesture';
import styles from './DecisionControls.module.css';

export interface DecisionControlsProps {
  /** The label of the reject control. Supplied; never a generic word such as no or cancel. */
  rejectLabel: string;
  /** The label of the approve control. Supplied; never a generic word such as yes or ok. */
  approveLabel: string;
  /** The approve label shown after the first interaction, while the confirmation window is open. */
  approveArmedLabel: string;
  /** The message announced to assistive technology when approve becomes armed. */
  approveArmedAnnouncement: string;
  /** The message announced to assistive technology when the confirmation window closes without approval. */
  approveDisarmedAnnouncement: string;
  /** The label shown on the control while the decision is being sent. */
  processingLabel: string;
  /** RESOLVED upstream of this component (acknowledgment, decision-ready, supplied upstream condition). This component renders it
   *  and never computes or infers it (BRD 1.2 5.10 Feature 2B). */
  approveEnabled: boolean;
  /** Resolved upstream too. Reject is available whenever the checkpoint can take a decision; it does not wait for the acknowledgment.
   *  It is unavailable only while the checkpoint is paused (for example revalidating after a lost connection). Defaults to true. */
  rejectEnabled?: boolean;
  /** Which decision is in flight, if any. Both controls are inert while one is, so there is exactly one decision event. */
  deciding: 'approve' | 'reject' | null;
  /** How long, in milliseconds, the second interaction is accepted after the first. Supplied upstream. */
  confirmWindowMs: number;
  /** `approve-intent`: emitted only after the confirmation gesture completes. */
  onApproveIntent: () => void;
  /** `reject`: a single action, available whether or not the acknowledgment was completed. */
  onReject: () => void;
}

// The two and ONLY two checkpoint controls, outcome-labelled (BRD 1.2 5.10). Neither is pre-focused. Reject is first in the focus
// order, so the safe action is reached first. Approval needs the confirmation gesture; rejection needs no confirmation.
export function DecisionControls({
  rejectLabel, approveLabel, approveArmedLabel, approveArmedAnnouncement, approveDisarmedAnnouncement, processingLabel,
  approveEnabled, rejectEnabled = true, deciding, confirmWindowMs, onApproveIntent, onReject,
}: DecisionControlsProps) {
  return (
    <div className={styles.controls}>
      <Button label={rejectLabel} variant="ghost" fullWidth disabled={deciding === 'approve' || !rejectEnabled} processing={deciding === 'reject'} processingLabel={processingLabel} onActivate={onReject} />
      <ConfirmationGesture
        label={approveLabel}
        armedLabel={approveArmedLabel}
        armedAnnouncement={approveArmedAnnouncement}
        disarmedAnnouncement={approveDisarmedAnnouncement}
        enabled={approveEnabled && deciding === null}
        processing={deciding === 'approve'}
        processingLabel={processingLabel}
        windowMs={confirmWindowMs}
        onComplete={onApproveIntent}
      />
    </div>
  );
}
