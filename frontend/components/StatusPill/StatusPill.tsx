import { StatusIndicator, type StatusState } from '../StatusIndicator/StatusIndicator';
import styles from './StatusPill.module.css';

export type PillTone = 'success' | 'warning' | 'error' | 'checkpoint' | 'neutral';

const SHAPE: Record<PillTone, StatusState> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  checkpoint: 'checkpoint',
  neutral: 'inactive',
};

export interface StatusPillProps {
  /** The status text, supplied. A pill renders a status; it never derives one from other data. */
  label: string;
  tone: PillTone;
  /** Hide the leading shape only when the label already says everything. The shape is the non-color carrier. */
  showShape?: boolean;
}

export function StatusPill({ label, tone, showShape = true }: StatusPillProps) {
  return (
    <span className={`${styles.pill} ${styles[tone]} type-caption`}>
      {showShape && <StatusIndicator state={SHAPE[tone]} label={label} decorative size="sm" />}
      <span>{label}</span>
    </span>
  );
}
