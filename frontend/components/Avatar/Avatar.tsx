import { Icon } from '../Icon/Icon';
import styles from './Avatar.module.css';

export interface AvatarProps {
  /** Initials, only when they are SUPPLIED. The component never derives them from a name: with none, a person glyph is shown. */
  initials?: string;
  /** Accessible full name, supplied. */
  label: string;
}

export function Avatar({ initials, label }: AvatarProps) {
  return (
    <span className={`${styles.avatar} type-heading-sm`} role="img" aria-label={label}>
      {initials ?? <Icon name="user" size="md" />}
    </span>
  );
}
