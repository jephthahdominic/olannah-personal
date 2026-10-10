import type { ReactNode } from 'react';
import { Surface } from '@/components';
import { upstreamMode } from '@/clients/upstream';
import { messages } from '@/render/messages';
import { MockPanel } from './MockPanel';
import styles from './auth.module.css';

// Shared frame for sign in and sign up. Auth lives OUTSIDE the canvas shell: the shell renders nothing until a session is
// confirmed. The mock fault panel is development-only and is hidden whenever the upstream mode is "real".
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Surface role="workspace" as="main" padding={6}>
      <div className={styles.page}>
        <p className={`${styles.wordmark} type-display`}>{messages.brand.name}</p>
        {children}
        {upstreamMode === 'mock' && <MockPanel />}
      </div>
    </Surface>
  );
}
