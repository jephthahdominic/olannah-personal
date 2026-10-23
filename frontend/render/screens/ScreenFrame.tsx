import type { ReactNode } from 'react';
import { Surface } from '@/components';
import styles from './ScreenFrame.module.css';

// Shared frame for shell-owned screens (loading, recovery, expired, fallback). Composed from foundation components
// only so these screens cannot fail for the same reason as the content they replace (SDD 6.5).
// No navigation, no zone scaffolding, no workspace content.
export function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <Surface role="workspace" as="main" padding={6}>
      <div className={styles.frame}>
        <p className={`${styles.wordmark} type-display`}>Olannah</p>
        <div className={styles.body}>{children}</div>
      </div>
    </Surface>
  );
}
