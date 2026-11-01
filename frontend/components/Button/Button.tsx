import type { ReactNode } from 'react';
import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'accent' | 'ghost';

export interface ButtonProps {
  /** Name the outcome, not the mechanism ("Sign in", never "Submit" or "OK"). BRD 1.2 5.5.1 Feature 4. */
  label: string;
  /** The visual weight: primary, accent or ghost. It never changes what the action means. */
  variant?: ButtonVariant;
  /** The native button type. Button by default; submit only inside a form. */
  type?: 'button' | 'submit';
  /** Makes the action unavailable. It stays visible at reduced opacity so the worker knows it exists. */
  disabled?: boolean;
  /** Awaiting an async result. Stays in place, keeps its label, shows inline progress, ignores repeat activation. */
  processing?: boolean;
  /** Accessible text announced while processing, supplied by the caller. */
  processingLabel?: string;
  /** Stretches the button to the width of its container. */
  fullWidth?: boolean;
  /** An icon shown before the label. It is replaced by the progress indicator while processing. */
  leading?: ReactNode;
  /** Emits upward. A Button executes no business consequence itself. */
  onActivate?: () => void;
}

export function Button({
  label,
  variant = 'primary',
  type = 'button',
  disabled = false,
  processing = false,
  processingLabel,
  fullWidth = false,
  leading,
  onActivate,
}: ButtonProps) {
  const inert = disabled || processing;
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.full : ''}`}
      // aria-disabled (not disabled) while processing keeps the control focusable and in place.
      aria-disabled={inert || undefined}
      aria-busy={processing || undefined}
      disabled={disabled && !processing}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onActivate?.();
      }}
    >
      {processing ? <StatusIndicator state="loading" label={processingLabel ?? label} decorative size="sm" /> : leading}
      <span className="type-heading-sm">{label}</span>
      {processing && processingLabel ? <span className="visually-hidden">{processingLabel}</span> : null}
    </button>
  );
}
