import { NavItem, type NavItemModel } from '../NavItem/NavItem';
import styles from './NavigationRail.module.css';

export interface NavigationRailProps {
  /** Rendered in the order SUPPLIED. The rail never reorders, filters, or decides which items a persona sees. */
  items: readonly NavItemModel[];
  /** The accessible name of the navigation landmark. */
  ariaLabel: string;
  /** Called with the destination id the worker chose. The canvas performs the navigation. */
  onSelect: (id: string) => void;
}

// Fixed vertical rail on tablet and desktop. Renders on the navigation zone chrome (Evergreen Dark).
export function NavigationRail({ items, ariaLabel, onSelect }: NavigationRailProps) {
  return (
    <nav className={styles.rail} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.destinationId}>
            <NavItem {...item} layout="rail" onActivate={onSelect} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
