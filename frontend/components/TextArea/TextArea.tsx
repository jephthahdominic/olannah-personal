import styles from './TextArea.module.css';

export interface TextAreaProps {
  /** Controlled: the composing layer owns the value (and the draft). The field holds no authoritative copy. */
  value: string;
  onChange: (value: string) => void;
  /** id of the visible label, set by FormField. Placeholder is never the label. */
  id: string;
  name?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

// Multi-line free text (feedback, notes). Structural limits only: business validity is never decided here (BRD 1.2 5.7).
export function TextArea({ value, onChange, id, name, rows = 4, maxLength, disabled, invalid, describedBy }: TextAreaProps) {
  return (
    <textarea
      id={id}
      name={name}
      className={`${styles.area} type-body`}
      value={value}
      rows={rows}
      maxLength={maxLength}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
