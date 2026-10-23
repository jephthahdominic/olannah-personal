'use client';

import { useEffect } from 'react';
import { Skeleton } from '../../Skeleton/Skeleton';
import styles from './CheckpointInitializing.module.css';

export interface CheckpointInitializingProps {
  /** Supplied plain-language status, announced politely. For example "Preparing the changes for your review". */
  statusMessage: string;
  /** The supplied window. If given, `timeout` is emitted once it elapses, so the wait is never indefinite (BRD 1.2 5.10 Feature 3).
   *  The controller owns the authoritative window; this is the component's own guarantee. */
  timeoutMs?: number;
  onTimeout?: () => void;
}

// The controlled wait between a trigger and its diff. It reserves the layout of the diff, the acknowledgment and the decision
// controls with non-interactive placeholders. The placeholders are aria-hidden: no acknowledgment or decision control is exposed
// to assistive technology until the checkpoint is decision-ready (BRD 1.3 11.6).
export function CheckpointInitializing({ statusMessage, timeoutMs, onTimeout }: CheckpointInitializingProps) {
  useEffect(() => {
    if (timeoutMs === undefined || !onTimeout) return;
    const handle = window.setTimeout(onTimeout, timeoutMs);
    return () => window.clearTimeout(handle);
  }, [timeoutMs, onTimeout]);

  return (
    <div className={styles.wrap}>
      <p className="visually-hidden" role="status">{statusMessage}</p>
      <div className={styles.placeholders} aria-hidden="true" inert>
        <Skeleton shape="card" cardHeight="lg" />
        <Skeleton shape="card" cardHeight="sm" />
        <div className={styles.actions}>
          <Skeleton shape="action-button" />
          <Skeleton shape="action-button" />
        </div>
      </div>
    </div>
  );
}
