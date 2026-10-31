'use client';

import type { Wire } from '@/contracts';
import { KeyValue, SectionHeader, formatSiteLocalDate, formatSiteLocalTime } from '@/components';
import type { ZoneContentProps } from '../layout/registry';
import { messages } from '../messages';
import styles from './zones.module.css';

// The work order Entity: a title and label/value fields, shown exactly as given. Nothing is interpreted, reordered or derived.
// `as_of` is shown so the worker can see how old it is. The canvas never decides what is too old.
export function WorkOrderContent({ state }: ZoneContentProps) {
  const entity = state.data as Wire.Entity | undefined;
  if (!entity) return null;
  return (
    <div>
      <div className={styles.entityTitle}>
        <SectionHeader text={entity.title} level={3} size="sm" />
      </div>
      <div className={styles.fields}>
        {entity.fields.map((field) => (
          <KeyValue key={`${field.label}-${field.value}`} label={field.label} value={field.value} />
        ))}
      </div>
      {state.asOf && (
        <p className={`${styles.asOf} type-body-sm`}>
          {messages.zones.workOrder.asOf} <time dateTime={state.asOf}>{formatAsOf(state.asOf)}</time>
        </p>
      )}
    </div>
  );
}

/** The delivered timestamp's own date and time as written, never converted to the viewer's time zone: "Oct 22, 4:40 PM". */
function formatAsOf(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${formatSiteLocalDate(m[1])}, ${formatSiteLocalTime(m[2])}` : iso;
}
