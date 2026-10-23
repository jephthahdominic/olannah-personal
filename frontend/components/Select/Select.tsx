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
  name?: string;
  /** SUPPLIED. The select renders these options and fetches none. It never decides which options are valid: that is the source
   *  system's business (BRD 1.2 5.7.1 Feature 2C). */
  options: readonly SelectOption[];
  /** Controlled: the composing layer owns the selection. `null` is "nothing chosen yet". Nothing is held as authoritative. */
  selection: string | null;
  onChange: (value: string) => void;
  /** Supplied text for the unselected state, for example "Choose a failure condition". Shown as a disabled first option. */
  placeholder: string;
  /** Supplied text shown instead of an empty list. Never blank. */
  emptyLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onFocus?: () => void;
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
