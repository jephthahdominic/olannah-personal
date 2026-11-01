import styles from './TextInput.module.css';

export interface TextInputProps {
  /** Controlled: the composing layer owns the value. The input holds no authoritative copy (BRD 1.2 5.7). */
  value: string;
  /** Called with the text as the worker types. The composing layer owns the value. */
  onChange: (value: string) => void;
  /** id of the visible label, set by FormField. Placeholder is never the label. */
  id: string;
  /** The native input type: text, email or password. */
  type?: 'text' | 'email' | 'password';
  /** The browser autofill hint, such as "email" or "current-password". */
  autoComplete?: string;
  /** Makes the field unavailable. It stays visible at reduced opacity. */
  disabled?: boolean;
  /** Marks the value as failing validation, so the field shows its error treatment. */
  invalid?: boolean;
  /** The id of the element that describes the field, such as its help or error text. */
  describedBy?: string;
  /** Marks the field as required for assistive technology and validation. */
  required?: boolean;
  /** The form field name used when the value is submitted. */
  name?: string;
  /** Upper bound enforced by the browser as well as by validation. */
  maxLength?: number;
  /** Which on-screen keyboard a phone shows: text, email, numeric or tel. */
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
