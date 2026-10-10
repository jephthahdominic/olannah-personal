import styles from './StatusIndicator.module.css';

// Status vocabulary (BRD 1.3 section 9.3 and 9.4). Color is never the only carrier: each state has its own SHAPE,
// and an accessible label always accompanies it. Checkpoint is the only OUTLINED shape (open = needs a decision).
export type StatusState = 'success' | 'warning' | 'error' | 'checkpoint' | 'inactive' | 'loading';

export interface StatusIndicatorProps {
  state: StatusState;
  /** Plain-language accessible name, supplied by the caller. Never derived from a code. */
  label: string;
  /** Hide from assistive technology when adjacent visible text already says the same thing. */
  decorative?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ state, label, decorative = false, size = 'md' }: StatusIndicatorProps) {
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': label };
  return (
    <svg className={`${styles.base} ${styles[size]} ${styles[state]}`} viewBox="0 0 24 24" {...a11y}>
      {state === 'success' && (
        <>
          <circle cx="12" cy="12" r="11" className={styles.fill} />
          <path d="M7 12.5l3.2 3.2L17 8.8" className={styles.mark} />
        </>
      )}
      {state === 'warning' && (
        <>
          <path d="M12 2.5L22.5 21h-21z" className={styles.fill} />
          <path d="M12 9v5.5M12 17.6v.4" className={styles.mark} />
        </>
      )}
      {state === 'error' && (
        <>
          <circle cx="12" cy="12" r="11" className={styles.fill} />
          <path d="M8 8l8 8M16 8l-8 8" className={styles.mark} />
        </>
      )}
      {state === 'checkpoint' && (
        <>
          <circle cx="12" cy="12" r="10" className={styles.outline} />
          <path d="M12 7.5v5.5M12 16.2v.4" className={styles.outlineMark} />
        </>
      )}
      {state === 'inactive' && <circle cx="12" cy="12" r="9" className={styles.fill} />}
      {state === 'loading' && (
        <>
          <circle cx="12" cy="12" r="9" className={styles.track} />
          <path d="M12 3a9 9 0 0 1 9 9" className={styles.arc} />
        </>
      )}
    </svg>
  );
}
