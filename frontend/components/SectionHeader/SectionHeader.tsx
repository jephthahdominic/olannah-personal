import type { ReactNode } from 'react';
import styles from './SectionHeader.module.css';

export type HeadingSize = 'sm' | 'md' | 'lg';
export type HeadingLevel = 1 | 2 | 3 | 4;

export interface SectionHeaderProps {
  text: string;
  size?: HeadingSize;
  /** Semantic level is independent of visual size. */
  level?: HeadingLevel;
  trailing?: ReactNode;
  id?: string;
}

// Renders heading text at the correct scale (sm to lg only; display is page-level and rarely used).
export function SectionHeader({ text, size = 'lg', level = 2, trailing, id }: SectionHeaderProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
  return (
    <div className={styles.row}>
      <Tag id={id} className={`type-heading-${size}`}>
        {text}
      </Tag>
      {trailing}
    </div>
  );
}
