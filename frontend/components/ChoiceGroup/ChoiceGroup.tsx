import { EmptyState } from '../EmptyState/EmptyState';
import styles from './ChoiceGroup.module.css';

export interface ChoiceOption {
  value: string;
  label: string;
  /** Supplied supporting text. */
  description?: string;
  disabled?: boolean;
}

export interface ChoiceGroupProps {
  /** Visible group label, exposed as the radio group's name. */
  legend: string;
  /** Shared by the radios. Unique per group on the page. */
  name: string;
  /** SUPPLIED. The component never hardcodes options or decides which are valid (BRD 1.2 5.7.1 Feature 2C). */
  options: readonly ChoiceOption[];
  /** Controlled: the composing layer owns the selection. Nothing is held as authoritative (BRD 1.2 5.7). */
  selection: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Supplied explanation when there are no options. Never blank. */
  emptyTitle: string;
  emptyExplanation: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

// Selects one choice from a short supplied list (BRD 1.2 5.7). Native radios give arrow-key movement and a radio group
// role for free. Every option row meets the 44px touch target on all breakpoints.
export function ChoiceGroup({ legend, name, options, selection, onChange, disabled = false, emptyTitle, emptyExplanation, onFocus, onBlur }: ChoiceGroupProps) {
  return (
    <fieldset className={styles.group} disabled={disabled}>
      <legend className="type-label">{legend}</legend>
      {options.length === 0 ? (
        <EmptyState title={emptyTitle} explanation={emptyExplanation} />
      ) : (
        options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <label key={option.value} htmlFor={id} className={styles.option} data-checked={selection === option.value || undefined}>
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={selection === option.value}
                disabled={option.disabled}
                aria-describedby={option.description ? `${id}-description` : undefined}
                className={styles.input}
                onChange={() => onChange(option.value)}
                onFocus={onFocus}
                onBlur={onBlur}
              />
              <span className={styles.mark} aria-hidden="true" />
              <span className={styles.text}>
                <span className="type-body">{option.label}</span>
                {option.description && (
                  <span id={`${id}-description`} className={`${styles.description} type-body-sm`}>
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })
      )}
    </fieldset>
  );
}
