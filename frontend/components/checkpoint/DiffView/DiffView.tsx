'use client';

import { useId, useState } from 'react';
import type { DiffPayload } from '@/contracts';
import { KeyValue } from '../../KeyValue/KeyValue';
import styles from './DiffView.module.css';

export interface DiffViewLabels {
  heading: string;
  targetSystem: string;
  record: string;
  originatingAgent: string;
  /** The two rows of every field. Supplied so the words are never hardcoded here. */
  now: string;
  willBe: string;
  /** Shown for a field with no current value. */
  noCurrentValue: string;
}

export interface DiffViewProps {
  /** Exactly what will be written, as supplied. Rendered, never transformed, edited or recomputed. */
  diff: DiffPayload;
  labels: DiffViewLabels;
}

// Read-only rendering of exactly what will be written (BRD 1.2 5.10 Feature 1). It accepts no input, and its content does not
// change after the first render for the life of the checkpoint: a later prop is ignored. If the upstream changes, the
// checkpoint ENDS and is reissued with a new identifier, which mounts a new DiffView. Every field shows its current and its
// proposed value as labeled text ("Now" and "Will be"), so a change is never communicated by color alone.
export function DiffView({ diff, labels }: DiffViewProps) {
  const [shown] = useState(diff);
  const headingId = useId();
  return (
    <section className={styles.diff} aria-labelledby={headingId}>
      <h3 id={headingId} className="type-heading-md">{labels.heading}</h3>
      <div className={styles.meta}>
        <KeyValue label={labels.targetSystem} value={shown.targetSystem} />
        <KeyValue label={labels.record} value={shown.recordId} />
        <KeyValue label={labels.originatingAgent} value={shown.originatingAgent} />
      </div>
      <ul className={styles.fields}>
        {shown.fields.map((field) => (
          <li key={field.id} className={styles.field}>
            <p className="type-label">{field.label}</p>
            <dl className={styles.values}>
              <div className={styles.current}>
                <dt className="type-caption">{labels.now}</dt>
                <dd className="type-data">{field.current ?? labels.noCurrentValue}</dd>
              </div>
              <div className={styles.proposed}>
                <dt className="type-caption">{labels.willBe}</dt>
                <dd className="type-data">{field.proposed}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
