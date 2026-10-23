import styles from './Label.module.css';

export interface LabelProps {
  text: string;
  /** Renders as a <span>; use FormField for a real form label. A Label never substitutes for one. */
  as?: 'span' | 'p';
}

// Uppercase microcopy for fields, groups and regions (BRD 1.3 type-label).
export function Label({ text, as: Tag = 'span' }: LabelProps) {
  return <Tag className={`${styles.label} type-label`}>{text}</Tag>;
}
