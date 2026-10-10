import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import { Button } from '../Button/Button';
import styles from './InlineError.module.css';

export interface InlineErrorProps {
  /** Plain-language title and body, SUPPLIED. A component never turns a code into text (BRD 1.2 5.2 Feature 8). */
  title: string;
  body?: string;
  /** Recovery path where one exists. If none exists, say so in `body`. */
  retryLabel?: string;
  onRetry?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
  /** failure = error token + circle-cross. degraded = warning token + triangle. They must look different. */
  tone?: 'failure' | 'degraded';
}

export function InlineError({ title, body, retryLabel, onRetry, dismissLabel, onDismiss, tone = 'failure' }: InlineErrorProps) {
  return (
    <div className={`${styles.box} ${tone === 'failure' ? styles.failure : styles.degraded}`} role={tone === 'failure' ? 'alert' : 'status'}>
      <StatusIndicator state={tone === 'failure' ? 'error' : 'warning'} label={tone === 'failure' ? 'Problem' : 'Limited'} decorative size="lg" />
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
