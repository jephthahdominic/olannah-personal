import { Label } from '../Label/Label';
import styles from './StatTile.module.css';

export interface StatTileProps {
  label: string;
  /** SUPPLIED. A tile renders a figure and never computes one (a count, a total, a percentage). */
  value: string | number;
  caption?: string;
  /** Emphasis chosen upstream. `attention` is a warning border plus the dark amber caption, never color alone: the
   *  caption text carries the meaning. */
  tone?: 'default' | 'attention' | 'success';
}

// A key figure with its label (the "Jobs today / Late / On schedule" tiles in the approved designs).
export function StatTile({ label, value, caption, tone = 'default' }: StatTileProps) {
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <p className={`${styles.value} type-display`}>{value}</p>
      <Label text={label} as="p" />
      {caption && <p className={`${styles.caption} type-caption`}>{caption}</p>}
    </div>
  );
}
