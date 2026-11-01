import { Icon, type IconName } from '../Icon/Icon';
import styles from './NavItem.module.css';

// What a navigation item needs to render. The shell builds these; components never resolve routes, decide which
// destinations a persona sees, or decide which item is active (BRD 1.2 5.15).
export interface NavItemModel {
  /** Stable identifier of the destination. Matching, comparison and restoration use identifiers, never labels or routes. */
  destinationId: string;
  /** The destination name shown under or beside the icon, as supplied. A tenant may override it. */
  label: string;
  /** The Tabler outline glyph for the destination. */
  icon: IconName;
  /** Active is a SUPPLIED presentation condition, not an interaction state. */
  active?: boolean;
  /** A destination that cannot currently be reached. Supplied. Never uses the 40% disabled treatment. */
  unavailable?: boolean;
  /** Supplied explanation, announced to assistive technology. */
  unavailableReason?: string;
}

export interface NavItemProps extends NavItemModel {
  /** Whether the item sits in the side rail or the bottom tab bar. */
  layout: 'rail' | 'tab';
  /** Called with the destination id when the worker activates the item. It never navigates itself. */
  onActivate: (id: string) => void;
  /** Extra aria for the More item that controls a menu. */
  ariaExpanded?: boolean;
  /** Marks the item as one that opens a menu, such as More. */
  ariaHasPopup?: boolean;
}

export function NavItem({ destinationId, label, icon, active, unavailable, unavailableReason, layout, onActivate, ariaExpanded, ariaHasPopup }: NavItemProps) {
  const reasonId = unavailable ? `nav-${destinationId}-reason` : undefined;
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
      onClick={() => onActivate(destinationId)}
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
