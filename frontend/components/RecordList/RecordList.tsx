import { EmptyState } from '../EmptyState/EmptyState';
import { Icon } from '../Icon/Icon';
import { StatusPill, type PillTone } from '../StatusPill/StatusPill';
import { formatSiteLocalTime } from '../utils/formatSiteLocal';
import styles from './RecordList.module.css';

export interface RecordRow {
  id: string;
  /** Site-local "HH:MM". Formatted, never converted. */
  timeLocal?: string;
  title: string;
  subtitle?: string;
  trailing?: string;
  status?: { label: string; tone: PillTone };
}

export interface RecordListProps {
  /** Rendered in the order SUPPLIED. A list never sorts or filters for correctness (BRD 1.2 5.6.1 Feature 2). */
  records: readonly RecordRow[];
  /** The accessible name of the list. */
  ariaLabel: string;
  /** A short statement that there are no records. SUPPLIED. */
  emptyTitle: string;
  /** Why there are no records and what would cause some to appear. SUPPLIED. Never blank. */
  emptyExplanation: string;
  /** When given, rows are buttons that emit `row-select`. */
  onSelect?: (id: string) => void;
}

// Ordered rows: work-order lists, queues, line items (BRD 1.2 5.6).
export function RecordList({ records, ariaLabel, emptyTitle, emptyExplanation, onSelect }: RecordListProps) {
  if (records.length === 0) return <EmptyState title={emptyTitle} explanation={emptyExplanation} />;
  return (
    <ul className={styles.list} aria-label={ariaLabel}>
      {records.map((r) => {
        const body = (
          <>
            {r.timeLocal && <span className={`${styles.time} type-data`}>{formatSiteLocalTime(r.timeLocal)}</span>}
            <span className={styles.text}>
              <span className={styles.titleRow}>
                <span className="type-body">{r.title}</span>
                {r.status && <StatusPill label={r.status.label} tone={r.status.tone} />}
              </span>
              {r.subtitle && <span className={`${styles.subtitle} type-body-sm`}>{r.subtitle}</span>}
            </span>
            {r.trailing && <span className={`${styles.trailing} type-data`}>{r.trailing}</span>}
            {onSelect && <Icon name="chevron-right" size="md" />}
          </>
        );
        return (
          <li key={r.id} className={styles.item}>
            {onSelect ? (
              <button type="button" className={`${styles.row} ${styles.button}`} onClick={() => onSelect(r.id)}>
                {body}
              </button>
            ) : (
              <div className={styles.row}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
