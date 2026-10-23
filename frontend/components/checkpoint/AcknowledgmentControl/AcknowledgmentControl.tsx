'use client';

import { Icon } from '../../Icon/Icon';
import styles from './AcknowledgmentControl.module.css';

export interface AcknowledgmentControlProps {
  /** The fixed confirmation statement, SUPPLIED. It is identical for every checkpoint and persona. This control never authors it. */
  statement: string;
  /** The checkpoint instance this acknowledgment belongs to. A new id is a new control: acknowledgment never carries over. */
  checkpointId: string;
  /** Supplied. This control does not compute eligibility or decide whether the diff was viewed. */
  acknowledged: boolean;
  /** Supplied for the revalidation window, when no action should be possible. */
  disabled?: boolean;
  /** `acknowledge`: the worker completed the explicit action. It resolves the checkpoint's acknowledgment state, which the canvas
   *  turns into approveEnabled. This control never enables approval directly. */
  onAcknowledge: () => void;
}

// The explicit "I have reviewed the proposed changes" confirmation (BRD 1.3 8.7 and 11.6, 1.2 5.10). The WHOLE container is
// the target (44px or more) and a single Tab stop between the diff and the decision controls. Space (and Enter) activates it.
// It states what it means and does not claim the worker actually attended to the diff: it records a representation only.
export function AcknowledgmentControl({ statement, checkpointId, acknowledged, disabled = false, onAcknowledge }: AcknowledgmentControlProps) {
  return (
    <button
      key={checkpointId}
      type="button"
      role="checkbox"
      aria-checked={acknowledged}
      aria-label={statement}
      aria-disabled={disabled || undefined}
      data-checkpoint={checkpointId}
      data-acknowledged={acknowledged || undefined}
      className={styles.control}
      onClick={() => {
        if (disabled || acknowledged) return;
        onAcknowledge();
      }}
    >
      <span className={`${styles.statement} type-body-sm`}>{statement}</span>
      {/* An empty circle becomes a filled circle with a check: a shape change, never color alone. */}
      <span className={styles.toggle} aria-hidden="true">
        {acknowledged && <Icon name="check" size="sm" />}
      </span>
    </button>
  );
}
