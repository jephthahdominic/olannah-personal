import type { ReactNode } from 'react';
import styles from './Surface.module.css';

// Sole owner of structural container background (BRD 1.2 5.5.1). Four roles only, no shadow, no elevation.
export type SurfaceRole = 'workspace' | 'card' | 'panel' | 'chrome';

export interface SurfaceProps {
  role: SurfaceRole;
  children?: ReactNode;
  as?: 'div' | 'section' | 'main' | 'aside' | 'header';
  /** Spacing token name, e.g. 4 means --space-4. Internal padding only; Surface applies no outer margin. */
  padding?: 3 | 4 | 5 | 6 | 8;
  /** Cards separate from the cream workspace by border, not shadow (BRD 1.3 section 7). */
  bordered?: boolean;
  className?: string;
}

export function Surface({ role, children, as: Tag = 'div', padding = 4, bordered = role === 'card', className }: SurfaceProps) {
  const classes = [styles.surface, styles[role], styles[`p${padding}`], bordered ? styles.bordered : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
