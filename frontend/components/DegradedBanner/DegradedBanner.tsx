import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import { Button } from '../Button/Button';
import styles from './DegradedBanner.module.css';

export interface DegradedBannerProps {
  /** The limitation, what it affects and what the worker can do, in plain words. Supplied text. Never generated from a condition code. */
  message: string;
  /** The label of the dismiss control. Supplied text. */
  dismissLabel?: string;
  /** Called when the worker dismisses the banner (the `dismiss` event). */
  onDismiss?: () => void;
}

// Signals a source is read-only or intermittently available (BRD 1.2 5.8). It is a degraded condition, so it always uses the semantic
// warning token and the warning triangle. A failure is a different surface (InlineError) and never renders here.
export function DegradedBanner({ message, dismissLabel, onDismiss }: DegradedBannerProps) {
  return (
    <div className={styles.banner} role="status">
      <StatusIndicator state="warning" label="Limited" decorative />
      <p className="type-body-sm">{message}</p>
      <div className={styles.actions}>
        {onDismiss && dismissLabel && <Button label={dismissLabel} variant="ghost" onActivate={onDismiss} />}
      </div>
    </div>
  );
}
