'use client';

import type { Wire } from '@/contracts';
import { RecordList, Surface } from '@/components';
import { messages } from '../messages';
import styles from './Dashboard.module.css';

// A heading, then one card: its own title and caption on a panel strip, and the stops beneath as rows. Rows are in the order supplied and the
// caption ("2 stops") is supplied, never counted. Selecting a stop emits upward; the shell decides where it goes.
export function ScheduleGroup({ group, onSelect }: { group: Wire.DashboardGroup; onSelect: (id: string) => void }) {
  const records = group.items.map((stop) => ({
    id: stop.id,
    ...(stop.time_local ? { timeLocal: stop.time_local } : {}),
    title: stop.title,
    ...(stop.subtitle ? { subtitle: stop.subtitle } : {}),
    ...(stop.status ? { status: stop.status } : {}),
  }));
  return (
    <section className={styles.group} aria-label={group.heading}>
      <h2 className="type-heading-md">{group.heading}</h2>
      <Surface role="card">
        <div className={styles.groupCard}>
          <div className={styles.groupHead}>
            <h3 className="type-heading-sm">{group.title}</h3>
            {group.caption && <span className={`${styles.muted} type-body-sm`}>{group.caption}</span>}
          </div>
          <RecordList records={records} ariaLabel={group.title} emptyTitle={messages.dashboard.emptyTitle} emptyExplanation={messages.dashboard.emptyBody} onSelect={onSelect} />
        </div>
      </Surface>
    </section>
  );
}
