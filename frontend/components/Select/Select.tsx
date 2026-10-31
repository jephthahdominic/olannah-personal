import { Icon } from '../Icon/Icon';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** id of the visible label, set by FormField. A placeholder is never the label. */
  id: string;
  /** The form field name used when the value is submitted. */
  name?: string;
  /** SUPPLIED. The select renders these options and fetches none. It never decides which options are valid: that is the source
   *  system's business (BRD 1.2 5.7.1 Feature 2C). */
  options: readonly SelectOption[];
  /** Controlled: the composing layer owns the selection. `null` is "nothing chosen yet". Nothing is held as authoritative. */
  selection: string | null;
  /** Called with the value of the option the worker chose. */
  onChange: (value: string) => void;
  /** Supplied text for the unselected state, for example "Choose a failure condition". Shown as a disabled first option. */
  placeholder: string;
  /** Supplied text shown instead of an empty list. Never blank. */
  emptyLabel: string;
  /** Makes the field unavailable. It stays visible at reduced opacity. */
  disabled?: boolean;
  /** Marks the value as failing validation, so the field shows its error treatment. */
  invalid?: boolean;
  /** The id of the element that describes the field, such as its help or error text. */
  describedBy?: string;
  /** Called when the field receives focus. */
  onFocus?: () => void;
  /** Called when the field loses focus. */
  onBlur?: () => void;
}

// Chooses one option from a supplied set (BRD 1.2 5.7). It is a native <select>: the browser supplies the open list, keyboard
// operation, the platform picker on a phone, and the right accessibility semantics. Only the closed control is styled, so the
// worker gets the same behaviour they already know on every device.
export function Select({ id, name, options, selection, onChange, placeholder, emptyLabel, disabled, invalid, describedBy, onFocus, onBlur }: SelectProps) {
  const empty = options.length === 0;
  return (
    <div className={styles.wrap}>
      <select
        id={id}
        name={name}
        className={`${styles.select} type-body`}
        value={selection ?? ''}
        disabled={disabled || empty}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <option value="" disabled>
          {empty ? emptyLabel : placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        <Icon name="chevron-down" size="md" />
      </span>
    </div>
  );
}
