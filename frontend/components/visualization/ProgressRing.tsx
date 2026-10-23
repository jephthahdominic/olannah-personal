import { percentOf } from './vizShared';
import styles from './ProgressRing.module.css';

export interface ProgressRingProps {
  /** SUPPLIED, named by what they measure. The ring draws the ratio; it never turns it into a derived status (BRD 1.2 5.9). */
  value: number;
  total: number;
  /** The figure written in the CENTRE, supplied and short (for example "70%" or "7/10"). A ring without it forces the worker to
   *  estimate a proportion by eye, which introduces error into operational decisions (BRD 1.3 section 10.5). */
  centeredLabel: string;
  /** Supplied plain-text equivalent, exposed to assistive technology. */
  textAlternative: string;
  /** 32px or 48px (BRD 1.3 section 10.3). */
  size?: 32 | 48;
  /** Supplied explanation when there is nothing to draw (no total). Never blank. */
  emptyExplanation: string;
}

// Completion against a whole: quote completeness, SLA countdown, capacity utilisation. The ring uses the visualization palette,
// never a semantic colour, so a worker never has to ask whether a ring is "red because it is an error or because it is category four".
export function ProgressRing({ value, total, centeredLabel, textAlternative, size = 48, emptyExplanation }: ProgressRingProps) {
  if (!(total > 0) || !Number.isFinite(value)) return <p className={`${styles.empty} type-caption`}>{emptyExplanation}</p>;
  const pct = percentOf(value, total);
  return (
    <span className={`${styles.ring} ${size === 32 ? styles.small : styles.large}`} role="img" aria-label={textAlternative}>
      <svg className={styles.svg} viewBox="0 0 36 36" aria-hidden="true">
        <circle className={styles.track} cx="18" cy="18" r="15.9155" fill="none" strokeWidth="4" />
        {/* pathLength 100 makes the dash length equal the percentage. Rotated so the arc starts at the top. */}
        <circle className={styles.arc} cx="18" cy="18" r="15.9155" fill="none" strokeWidth="4" pathLength="100" strokeDasharray={`${pct} ${100 - pct}`} transform="rotate(-90 18 18)" />
      </svg>
      <span className={`${styles.center} ${size === 32 ? 'type-caption' : 'type-data'}`} aria-hidden="true">
        {centeredLabel}
      </span>
    </span>
  );
}
