import type { ReactNode } from 'react';
import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import styles from './FormField.module.css';

export interface FormFieldProps {
  id: string;
  /** Visible, programmatically associated label. Persists when the field holds a value. */
  label: string;
  /** The wrapped control. It must use `id` and may set aria-describedby to `${id}-message`. */
  children: ReactNode;
  /** Supplied validation text. The wrapper never computes business validity. */
  validationMessage?: string;
  helpText?: string;
}

export function FormField({ id, label, children, validationMessage, helpText }: FormFieldProps) {
  const messageId = `${id}-message`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      {children}
      {validationMessage ? (
        <p id={messageId} className={`${styles.message} type-body-sm`}>
          <StatusIndicator state="error" label="Problem" decorative size="sm" />
          <span>{validationMessage}</span>
        </p>
      ) : helpText ? (
        <p id={messageId} className={`${styles.help} type-body-sm`}>
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
