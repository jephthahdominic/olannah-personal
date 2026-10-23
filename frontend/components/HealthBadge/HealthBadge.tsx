import { StatusIndicator, type StatusState } from '../StatusIndicator/StatusIndicator';
import styles from './HealthBadge.module.css';

export type Availability = 'available' | 'degraded' | 'unavailable';
export type BadgeConnection = 'connected' | 'reconnecting' | 'disconnected';

export interface HealthBadgeProps {
  /** SUPPLIED. A badge renders availability and never derives it from other data (BRD 1.2 5.8). */
  availability: Availability;
  /**
   * The runtime dimension: is the feed that reports this availability itself live? When it is not, the badge cannot confirm
   * what it shows, so it says so with a different shape instead of presenting a stale answer as current (BRD 1.2 5.8.1 Feature 1).
   */
  connection?: BadgeConnection;
  /** Supplied plain-language name, for example "Service ERP is available". Exposed to assistive technology. */
  label: string;
  /** Optional visible text beside the shape. Shape plus label always carries the state, never color alone. */
  text?: string;
}

const SHAPE: Record<Availability, StatusState> = { available: 'success', degraded: 'warning', unavailable: 'error' };

// Connector availability or upstream system health (BRD 1.2 5.8): a small shape-plus-colour marker at the icon-sm size (16px).
export function HealthBadge({ availability, connection = 'connected', label, text }: HealthBadgeProps) {
  // Freshness of the answer is separate from the answer: a lost feed overrides the shape rather than disguising itself as one.
  const state: StatusState = connection === 'reconnecting' ? 'loading' : connection === 'disconnected' ? 'inactive' : SHAPE[availability];
  return (
    <span className={`${styles.badge} type-caption`} data-availability={availability} data-connection={connection}>
      <StatusIndicator state={state} label={label} size="sm" />
      {text && <span>{text}</span>}
    </span>
  );
}
