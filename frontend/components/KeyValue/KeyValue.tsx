import { Label } from '../Label/Label';
import styles from './KeyValue.module.css';

export interface KeyValueProps {
  label: string;
  /** Rendered exactly as supplied. A KeyValue never reformats a value into a different meaning, and renders no
   *  placeholder when the value is absent: an absent value renders an empty value, not invented content. */
  value?: string;
  /** Emphasis flag from the composing layer. Data values are medium weight, not bold (BRD 1.3 section 4.2). */
  emphasis?: boolean;
}

// The atomic labeled-value unit (BRD 1.2 5.6).
export function KeyValue({ label, value, emphasis = false }: KeyValueProps) {
  return (
    <div className={styles.pair}>
      <Label text={label} as="p" />
      <p className={`${styles.value} ${emphasis ? 'type-heading-sm' : 'type-data'}`}>{value}</p>
    </div>
  );
}
