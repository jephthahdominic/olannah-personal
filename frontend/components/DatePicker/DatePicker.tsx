import { isRealIsoDate, withinBounds } from '../utils/isoDate';
import styles from './DatePicker.module.css';

export interface DatePickerProps {
  /** id of the visible label, set by FormField. A placeholder is never the label. */
  id: string;
  name?: string;
  /**
   * What this date MEANS, named specifically (for example `departure-date`, `valid-through`), never a generic "date" (BRD 1.2
   * 5.7.1 Feature 5). Field services is a locality problem from week one: two dates with different meanings must never be
   * collapsed into one field.
   */
  meaning: string;
  /** Controlled: site-local "YYYY-MM-DD" or null for empty. The composing layer owns it. The picker holds no authoritative copy. */
  value: string | null;
  /** Emits a real calendar date inside the supplied bounds, or null when cleared. Anything else is ignored. */
  onChange: (value: string | null) => void;
  /** SUPPLIED bounds, "YYYY-MM-DD". The picker enforces them but never derives them (BRD 1.2 5.7.1 Feature 6). */
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

// Captures a date (BRD 1.2 5.7). It uses the platform date control, which brings a native calendar on a phone, keyboard entry on
// a desktop and the right accessibility semantics. Dates are site-local and are never converted to the viewer's time zone.
export function DatePicker({ id, name, meaning, value, onChange, min, max, disabled, invalid, describedBy, onFocus, onBlur }: DatePickerProps) {
  return (
    <input
      id={id}
      name={name ?? meaning}
      type="date"
      data-meaning={meaning}
      className={`${styles.input} type-body`}
      value={value ?? ''}
      min={min}
      max={max}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        const next = event.target.value;
        if (next === '') return onChange(null);
        // A typed value can be impossible or outside the bounds (the browser only constrains its own picker). Ignore it: the
        // control is controlled, so it falls back to the last accepted value.
        if (isRealIsoDate(next) && withinBounds(next, min, max)) onChange(next);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
