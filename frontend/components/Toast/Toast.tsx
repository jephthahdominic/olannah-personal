'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import { Icon } from '../Icon/Icon';
import styles from './Toast.module.css';

export interface ToastProps {
  /** Supplied text. A toast never builds its message from a code. */
  message: string;
  tone?: 'success' | 'info';
  /** Default 7 seconds (BRD 1.2 5.8 Feature 8). The shell passes the configured value. */
  durationMs?: number;
  dismissLabel: string;
  onDismiss: () => void;
}

// Transient, non-blocking. Auto-dismisses after the duration, but the timer PAUSES while hovered or focused and resumes
// on leave, so a worker can extend reading time (WCAG 2.2.1). Never persists beyond the supplied duration otherwise.
export function Toast({ message, tone = 'info', durationMs = 7000, dismissLabel, onDismiss }: ToastProps) {
  const remaining = useRef(durationMs);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, force] = useState(0);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    clear();
    startedAt.current = Date.now();
    timer.current = setTimeout(onDismiss, remaining.current);
  }, [clear, onDismiss]);

  const pause = useCallback(() => {
    if (startedAt.current !== null) remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    startedAt.current = null;
    clear();
    force((n) => n + 1);
  }, [clear]);

  useEffect(() => {
    start();
    return clear;
  }, [start, clear]);

  return (
    <div
      className={`${styles.toast} ${styles[tone]}`}
      role="status"
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
    >
      <StatusIndicator state={tone === 'success' ? 'success' : 'inactive'} label={tone === 'success' ? 'Done' : 'Notice'} decorative />
      <p className="type-body-sm">{message}</p>
      <button type="button" className={styles.close} aria-label={dismissLabel} onClick={onDismiss}>
        <Icon name="x" size="sm" />
      </button>
    </div>
  );
}
