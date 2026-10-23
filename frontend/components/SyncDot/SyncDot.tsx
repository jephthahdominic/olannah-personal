import styles from './SyncDot.module.css';

// Marker of data freshness (BRD 1.2 5.8). Freshness and connectivity are SEPARATE dimensions and are never collapsed
// into one condition. Both are supplied. The dot is paired with a text label so color is never the only carrier.
export type Freshness = 'fresh' | 'syncing' | 'stale';
export type Connectivity = 'connected' | 'reconnecting' | 'disconnected';

export interface SyncDotProps {
  freshness: Freshness;
  connectivity?: Connectivity;
  /** Visible text beside the dot, supplied (for example "Synced"). */
  label: string;
}

export function SyncDot({ freshness, connectivity = 'connected', label }: SyncDotProps) {
  return (
    <span className={`${styles.wrap} type-caption`} data-freshness={freshness} data-connectivity={connectivity}>
      <span className={`${styles.dot} ${styles[freshness]} ${connectivity !== 'connected' ? styles.broken : ''}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
