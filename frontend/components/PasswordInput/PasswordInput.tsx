'use client';

import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './PasswordInput.module.css';

export interface PasswordInputProps {
  /** Controlled: the composing layer owns the value. This component never stores or logs it. */
  value: string;
  onChange: (value: string) => void;
  id: string;
  /** `current-password` for sign in, `new-password` for sign up and password change. Lets password managers help. */
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  name?: string;
  maxLength?: number;
  /** Supplied accessible names for the visibility toggle. */
  showLabel: string;
  hideLabel: string;
}

// A password field with a show/hide toggle. Showing a password is a recognized usability and accessibility practice
// (fewer typos, so fewer failed attempts and lockouts). Visibility is presentation state only and resets on remount.
// Paste is NEVER blocked: blocking paste defeats password managers and pushes workers toward weaker passwords.
export function PasswordInput({ value, onChange, id, autoComplete, disabled, invalid, describedBy, name, maxLength, showLabel, hideLabel }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.wrap}>
      <input
        id={id}
        name={name}
        className={`${styles.input} type-body`}
        type={visible ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className={styles.toggle}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size="md" />
      </button>
    </div>
  );
}
