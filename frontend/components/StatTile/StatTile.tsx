import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import styles from './StatTile.module.css';

export interface StatTileProps {
  /** What the figure is, such as "Jobs today". */
  label: string;
  /** SUPPLIED. A tile renders a figure and never computes one (a count, a total, a percentage). An unknown figure is supplied as an em dash. */
  value: string | number;
  /**
   * The shape beside the figure, SUPPLIED: a warning triangle or an error circle. Null shows none, including beside a zero. The tile never
   * decides that a figure needs attention: that is upstream's judgment, and the shape plus the label carry it, never colour alone.
   */
  status?: 'warning' | 'error' | null;
  /** A short supporting line under the figure. Supplied text. */
  caption?: string;
  /** Emphasis chosen upstream. `attention` adds a warning border. The caption text carries the meaning. */
  tone?: 'default' | 'attention' | 'success';
}

// A key figure with its label (the "Urgent / Late / Upcoming" tiles in the approved designs).
export function StatTile({ label, value, status = null, caption, tone = 'default' }: StatTileProps) {
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <p className={`${styles.figure} type-heading-lg`}>
        <span className={styles.value}>{value}</span>
        {status && <StatusIndicator state={status === 'warning' ? 'warning' : 'error'} label={status === 'warning' ? 'Needs attention' : 'Overdue'} decorative size="sm" />}
      </p>
      <p className={`${styles.label} type-body`}>{label}</p>
      {caption && <p className={`${styles.caption} type-body-sm`}>{caption}</p>}
    </div>
  );
}
