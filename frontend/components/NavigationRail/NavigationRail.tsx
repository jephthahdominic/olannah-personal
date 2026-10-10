import { NavItem, type NavItemModel } from '../NavItem/NavItem';
import styles from './NavigationRail.module.css';

export interface NavigationRailProps {
  /** Rendered in the order SUPPLIED. The rail never reorders, filters, or decides which items a persona sees. */
  items: readonly NavItemModel[];
  ariaLabel: string;
  onSelect: (id: string) => void;
}

// Fixed vertical rail on tablet and desktop. Renders on the navigation zone chrome (Evergreen Dark).
export function NavigationRail({ items, ariaLabel, onSelect }: NavigationRailProps) {
  const main = items.filter((i) => !i.pinned);
  const pinned = items.filter((i) => i.pinned);
  return (
    <nav className={styles.rail} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {main.map((item) => (
          <li key={item.id}>
            <NavItem {...item} layout="rail" onActivate={onSelect} />
          </li>
        ))}
      </ul>
      {pinned.length > 0 && (
        <ul className={styles.pinned}>
          {pinned.map((item) => (
            <li key={item.id}>
              <NavItem {...item} layout="rail" onActivate={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
