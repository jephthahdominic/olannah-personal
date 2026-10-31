import type { ReactNode } from 'react';
import styles from './PageBand.module.css';

// The dark band under the topbar: the page title, and the Context Header when there is an active job. It is the first thing a worker
// reads, so it says where they are and which job they are on, and nothing else. (Layout from the approved designs.)
export function PageBand({ title, children }: { title: string | null; children?: ReactNode }) {
  if (!title && !children) return null;
  return (
    <div className={styles.band}>
      <div className={styles.inner}>
        {title && <h1 className={`${styles.title} type-display`}>{title}</h1>}
        {children}
      </div>
    </div>
  );
}
