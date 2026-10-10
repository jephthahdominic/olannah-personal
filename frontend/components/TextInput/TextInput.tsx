import styles from './TextInput.module.css';

export interface TextInputProps {
  /** Controlled: the composing layer owns the value. The input holds no authoritative copy (BRD 1.2 5.7). */
  value: string;
  onChange: (value: string) => void;
  /** id of the visible label, set by FormField. Placeholder is never the label. */
  id: string;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  name?: string;
  /** Upper bound enforced by the browser as well as by validation. */
  maxLength?: number;
  inputMode?: 'text' | 'email' | 'numeric' | 'tel';
  /** Identifiers and passwords must not be auto-capitalized, auto-corrected or spell-checked (and sent to a dictionary). */
  hardened?: boolean;
}

export function TextInput({ value, onChange, id, type = 'text', autoComplete, disabled, invalid, describedBy, required, name, maxLength, inputMode, hardened }: TextInputProps) {
  return (
    <input
      id={id}
      name={name}
      maxLength={maxLength}
      inputMode={inputMode}
      {...(hardened ? { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } : {})}
      className={`${styles.input} type-body`}
      type={type}
      value={value}
      autoComplete={autoComplete}
      disabled={disabled}
      required={required}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
