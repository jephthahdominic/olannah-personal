import styles from './Link.module.css';

export interface LinkProps {
  label: string;
  /** Navigates. Provide this OR onActivate. */
  href?: string;
  /** Opens a secondary surface instead of navigating (for example the contextual feedback entry). Never a write or destructive
   *  action: those are Buttons and route through the checkpoint (BRD 1.2 5.5.1). */
  onActivate?: () => void;
  /** `on-chrome` for a link on an Evergreen surface (Warm Cream, never the default dark green). */
  tone?: 'default' | 'on-chrome';
}

export function Link({ label, href, onActivate, tone = 'default' }: LinkProps) {
  const cls = `${styles.link} ${tone === 'on-chrome' ? styles.onChrome : ''} type-body`;
  if (onActivate && !href) {
    return (
      <button type="button" className={`${cls} ${styles.asButton}`} onClick={onActivate}>
        {label}
      </button>
    );
  }
  return (
    <a className={cls} href={href}>
      {label}
    </a>
  );
}
