import { Icon, type IconName } from '../Icon/Icon';
import styles from './NavItem.module.css';

// What a navigation item needs to render. The shell builds these; components never resolve routes, decide which
// destinations a persona sees, or decide which item is active (BRD 1.2 5.15).
export interface NavItemModel {
  /** Stable identifier. Matching, comparison and restoration use identifiers, never labels or routes. */
  id: string;
  label: string;
  icon: IconName;
  /** Active is a SUPPLIED presentation condition, not an interaction state. */
  active?: boolean;
  /** A destination that cannot currently be reached. Supplied. Never uses the 40% disabled treatment. */
  unavailable?: boolean;
  /** Supplied explanation, announced to assistive technology. */
  unavailableReason?: string;
  /** Rail only: pinned to the bottom (Settings). */
  pinned?: boolean;
}

export interface NavItemProps extends NavItemModel {
  layout: 'rail' | 'tab';
  onActivate: (id: string) => void;
  /** Extra aria for the More item that controls a menu. */
  ariaExpanded?: boolean;
  ariaHasPopup?: boolean;
}

export function NavItem({ id, label, icon, active, unavailable, unavailableReason, layout, onActivate, ariaExpanded, ariaHasPopup }: NavItemProps) {
  const reasonId = unavailable ? `nav-${id}-reason` : undefined;
  return (
    <button
      type="button"
      className={`${styles.item} ${styles[layout]} ${active ? styles.active : ''} ${active ? 'type-nav-label-active' : 'type-nav-label'}`}
      aria-current={active ? 'page' : undefined}
      aria-label={undefined}
      // Unavailable stays focusable and discoverable, and activates to an explanation (the shell supplies it).
      aria-disabled={unavailable || undefined}
      aria-describedby={reasonId}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup ? 'menu' : undefined}
      onClick={() => onActivate(id)}
    >
      <span className={styles.icon}>
        <Icon name={icon} size="md" />
        {unavailable && (
          <span className={styles.marker}>
            <Icon name="wifi-off" size="xs" />
          </span>
        )}
      </span>
      <span className={styles.label}>{label}</span>
      {unavailable && unavailableReason && (
        <span id={reasonId} className="visually-hidden">
          {unavailableReason}
        </span>
      )}
    </button>
  );
}
