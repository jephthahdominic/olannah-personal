import { NavItem, type NavItemModel } from '../NavItem/NavItem';
import styles from './TabBar.module.css';

export interface TabBarProps {
  /** Rendered as supplied (at most five). */
  items: readonly NavItemModel[];
  ariaLabel: string;
  onSelect: (id: string) => void;
  /** The item that opens a menu (More) reports it. */
  menuItemId?: string;
  menuOpen?: boolean;
}

// Fixed bottom navigation on mobile. Same Evergreen Dark chrome as the rail.
export function TabBar({ items, ariaLabel, onSelect, menuItemId, menuOpen }: TabBarProps) {
  return (
    <nav className={styles.bar} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.cell}>
            <NavItem
              {...item}
              layout="tab"
              onActivate={onSelect}
              ariaHasPopup={item.id === menuItemId}
              ariaExpanded={item.id === menuItemId ? !!menuOpen : undefined}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
