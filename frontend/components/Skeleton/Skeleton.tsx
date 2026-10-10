import styles from './Skeleton.module.css';

// Standard loading representation for data-bearing content whose structure is known (BRD 1.3 section 8.3).
// The shapes below mirror the 1.3 table. A single shared shimmer sweeps all placeholders together; it does NOT run on
// action buttons or card frames, and it stops under reduced motion. There is no spinner component anywhere.
export type SkeletonShape =
  | 'title'
  | 'body'
  | 'body-short'
  | 'field-label'
  | 'field-value'
  | 'data-value'
  | 'icon'
  | 'avatar'
  | 'action-button'
  | 'context-row'
  | 'card';

const NO_SHIMMER: SkeletonShape[] = ['action-button', 'card'];

export interface SkeletonProps {
  shape: SkeletonShape;
  /** Cards have variable height. Ignored for every other shape. */
  cardHeight?: 'sm' | 'md' | 'lg';
}

export function Skeleton({ shape, cardHeight = 'md' }: SkeletonProps) {
  const shimmer = !NO_SHIMMER.includes(shape);
  return (
    <span
      aria-hidden="true"
      className={`${styles.base} ${styles[shape]} ${shape === 'card' ? styles[`card-${cardHeight}`] : ''} ${shimmer ? styles.shimmer : ''}`}
    />
  );
}
