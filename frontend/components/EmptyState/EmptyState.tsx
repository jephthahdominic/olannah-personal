import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Why there is nothing here, and what would cause data to appear. SUPPLIED. Never blank, never invented. */
  title: string;
  explanation: string;
  actionLabel?: string;
  onAction?: () => void;
}

// An empty state is NOT an error: it uses neither the warning nor the error token (BRD 1.0 section 6).
export function EmptyState({ title, explanation, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className={styles.box}>
      <Icon name="inbox" size="lg" />
      <p className="type-heading-sm">{title}</p>
      <p className={`${styles.text} type-body-sm`}>{explanation}</p>
      {onAction && actionLabel && <Button label={actionLabel} variant="ghost" onActivate={onAction} />}
    </div>
  );
}
