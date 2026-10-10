import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import { Button } from '../Button/Button';
import { Link } from '../Link/Link';
import styles from './DegradedBanner.module.css';

export interface DegradedBannerProps {
  /** Supplied text. Never generated from a condition code. */
  message: string;
  /** Warning token while reconnecting; error token once reconnection has failed (BRD 1.0 error rows 8 and 9). */
  severity?: 'warning' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** A secondary action that navigates (for example contact support) is a Link, not a Button. */
  secondaryHref?: string;
}

// Signals a source is read-only or intermittently available. It does not obscure zone content.
export function DegradedBanner({ message, severity = 'warning', actionLabel, onAction, secondaryLabel, onSecondary, secondaryHref }: DegradedBannerProps) {
  return (
    <div className={`${styles.banner} ${styles[severity]}`} role="status">
      <StatusIndicator state={severity === 'warning' ? 'warning' : 'error'} label={severity === 'warning' ? 'Limited' : 'Problem'} decorative />
      <p className="type-body-sm">{message}</p>
      <div className={styles.actions}>
        {onAction && actionLabel && <Button label={actionLabel} variant="ghost" onActivate={onAction} />}
        {onSecondary && secondaryLabel && <Button label={secondaryLabel} variant="ghost" onActivate={onSecondary} />}
        {secondaryHref && secondaryLabel && <Link label={secondaryLabel} href={secondaryHref} />}
      </div>
    </div>
  );
}
