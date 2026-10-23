import { Label } from '../Label/Label';
import { StatusPill, type PillTone } from '../StatusPill/StatusPill';
import styles from './DetailRow.module.css';

export interface DetailRowProps {
  label: string;
  /** Rendered exactly as supplied. An absent value renders an empty value, never a placeholder (BRD 1.2 5.6). */
  value?: string;
  /** SUPPLIED trailing status. Rendered by StatusPill and never derived from the value (BRD 1.2 5.6.1 Feature 1B). */
  status?: { label: string; tone: PillTone };
  /** `multi` places label and value side by side from tablet up and collapses to one column on mobile (BRD 1.3 section 6.4). */
  columnContext?: 'single' | 'multi';
}

// A labeled value in a row context (BRD 1.2 5.6). It owns no background: it inherits the Surface of its zone.
export function DetailRow({ label, value, status, columnContext = 'single' }: DetailRowProps) {
  return (
    <div className={`${styles.row} ${columnContext === 'multi' ? styles.multi : ''}`}>
      <Label text={label} as="p" />
      <p className={`${styles.value} type-data`}>{value}</p>
      {status && (
        <span className={styles.status}>
          <StatusPill label={status.label} tone={status.tone} />
        </span>
      )}
    </div>
  );
}
