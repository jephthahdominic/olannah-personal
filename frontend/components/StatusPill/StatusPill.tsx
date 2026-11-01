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
  /** The meaning the pill carries: success, warning, error, checkpoint or neutral. The label always says it in words too. */
  tone: PillTone;
}

export function StatusPill({ label, tone }: StatusPillProps) {
  return (
    <span className={`${styles.pill} ${styles[tone]} type-data`}>
      <StatusIndicator state={SHAPE[tone]} label={label} decorative size="sm" />
      <span>{label}</span>
    </span>
  );
}
