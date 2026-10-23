import styles from './Avatar.module.css';

export interface AvatarProps {
  /** Initials are SUPPLIED by the context object. The component never derives them from a name. */
  initials: string;
  /** Accessible full name, supplied. */
  label: string;
}

export function Avatar({ initials, label }: AvatarProps) {
  return (
    <span className={`${styles.avatar} type-heading-sm`} role="img" aria-label={label}>
      {initials}
    </span>
  );
}
