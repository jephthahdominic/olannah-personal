import { NavItem, type NavItemModel } from '../NavItem/NavItem';
import styles from './TabBar.module.css';

export interface TabBarProps {
  /** Rendered as supplied (at most five). */
  items: readonly NavItemModel[];
  /** The accessible name of the navigation landmark. */
  ariaLabel: string;
  /** Called with the destination id the worker chose. The canvas performs the navigation. */
  onSelect: (id: string) => void;
  /** The item that opens a menu (More) reports it. */
  menuItemId?: string;
  /** Whether the More menu is open, so the More item shows the right state. */
  menuOpen?: boolean;
}

// Fixed bottom navigation on mobile. Same Evergreen Dark chrome as the rail.
export function TabBar({ items, ariaLabel, onSelect, menuItemId, menuOpen }: TabBarProps) {
  return (
    <nav className={styles.bar} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.destinationId} className={styles.cell}>
            <NavItem
              {...item}
              layout="tab"
              onActivate={onSelect}
              ariaHasPopup={item.destinationId === menuItemId}
              ariaExpanded={item.destinationId === menuItemId ? !!menuOpen : undefined}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
