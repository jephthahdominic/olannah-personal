import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import { Button } from '../Button/Button';
import styles from './InlineError.module.css';

export interface InlineErrorProps {
  /** Plain-language title and body, SUPPLIED. A component never turns a code into text (BRD 1.2 5.2 Feature 8). */
  title: string;
  /** A second line explaining the failure in plain words. Supplied text. */
  body?: string;
  /** Recovery path where one exists. If none exists, say so in `body`. */
  retryLabel?: string;
  /** Called when the worker asks to retry the failed operation. */
  onRetry?: () => void;
  /** The label of the dismiss control. */
  dismissLabel?: string;
  /** Called when the worker dismisses the message. */
  onDismiss?: () => void;
}

// An in-context failure (BRD 1.2 5.8): the error token and the circle with a cross. A degraded source is a different surface (DegradedBanner).
export function InlineError({ title, body, retryLabel, onRetry, dismissLabel, onDismiss }: InlineErrorProps) {
  return (
    <div className={styles.box} role="alert">
      <StatusIndicator state="error" label="Problem" decorative size="lg" />
      <div className={styles.text}>
        <p className="type-heading-sm">{title}</p>
        {body && <p className="type-body-sm">{body}</p>}
        {(onRetry || onDismiss) && (
          <div className={styles.actions}>
            {onRetry && retryLabel && <Button label={retryLabel} variant="ghost" onActivate={onRetry} />}
            {onDismiss && dismissLabel && <Button label={dismissLabel} variant="ghost" onActivate={onDismiss} />}
          </div>
        )}
      </div>
    </div>
  );
}
