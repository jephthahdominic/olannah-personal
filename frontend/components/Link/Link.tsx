import styles from './Link.module.css';

export interface LinkProps {
  label: string;
  href: string;
}

// Navigates or opens a secondary surface. Never carries a write or destructive action (those are Buttons).
export function Link({ label, href }: LinkProps) {
  return (
    <a className={`${styles.link} type-body`} href={href}>
      {label}
    </a>
  );
}
