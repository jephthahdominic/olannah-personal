'use client';

import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './NumberInput.module.css';

export interface NumberInputProps {
  /** Controlled: the composing layer owns the value. `null` is an empty field. The input holds no authoritative copy. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** id of the visible label, set by FormField. Placeholder is never the label. */
  id: string;
  name?: string;
  /** SUPPLIED bounds and step. The input enforces them but never derives them (BRD 1.2 5.7.1 Feature 6). */
  minimum?: number;
  maximum?: number;
  step?: number;
  /** Steppers are one display option. Their accessible names are supplied. */
  steppers?: { decrementLabel: string; incrementLabel: string };
  /** Whether a decimal keypad is wanted. Integers by default. */
  decimal?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

const parse = (text: string): number | null => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n: number, min?: number, max?: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
// Avoid floating point drift such as 0.1 + 0.2 when stepping by a decimal step.
const tidy = (n: number) => Number(n.toFixed(10));

// Numeric entry for quantities (BRD 1.2 5.7). It calculates no totals and validates no pricing rules. While the worker types,
// the draft text is uncommitted presentation state; a value is emitted only when it is within the supplied bounds, and
// leaving the field settles an out-of-range entry to the nearest bound.
export function NumberInput({ value, onChange, id, name, minimum, maximum, step = 1, steppers, decimal = false, disabled, invalid, describedBy, onFocus, onBlur }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value));

  const move = (direction: 1 | -1) => {
    const base = value ?? (direction === 1 ? (minimum ?? 0) - step : (maximum ?? 0) + step);
    onChange(clamp(tidy(base + direction * step), minimum, maximum));
    setDraft(null);
  };
  const atMin = value !== null && minimum !== undefined && value <= minimum;
  const atMax = value !== null && maximum !== undefined && value >= maximum;

  const input = (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      className={`${styles.input} ${steppers ? styles.withSteppers : ''} type-body`}
      value={shown}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        const text = event.target.value;
        if (!/^-?\d*[.,]?\d*$/.test(text)) return; // structural constraint only: digits, sign and one separator
        setDraft(text);
        const n = parse(text);
        if (n === null) {
          if (text.trim() === '') onChange(null);
          return;
        }
        if ((minimum === undefined || n >= minimum) && (maximum === undefined || n <= maximum)) onChange(n);
      }}
      onFocus={onFocus}
      onBlur={() => {
        const n = parse(shown);
        if (n !== null) {
          const settled = clamp(n, minimum, maximum);
          if (settled !== value) onChange(settled);
        }
        setDraft(null);
        onBlur?.();
      }}
    />
  );
  if (!steppers) return input;
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.stepper} aria-label={steppers.decrementLabel} disabled={disabled || atMin} onClick={() => move(-1)}>
        <Icon name="minus" size="md" />
      </button>
      {input}
      <button type="button" className={styles.stepper} aria-label={steppers.incrementLabel} disabled={disabled || atMax} onClick={() => move(1)}>
        <Icon name="plus" size="md" />
      </button>
    </div>
  );
}
