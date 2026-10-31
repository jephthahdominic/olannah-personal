'use client';

import type { Wire } from '@/contracts';
import { EmptyState, RecordList, Surface } from '@/components';
import { useShell } from '../layout/ShellContext';
import type { ZoneContentProps } from '../layout/registry';
import { messages } from '../messages';
import styles from './WorkOrders.module.css';

// The Work Orders screen (approved design 04): the worker's assigned jobs, grouped as supplied (Today, Tomorrow), each row with its time, client,
// status and task. Everything shown is SUPPLIED, including the heading and the group headings. Rows are in the order sent and are never sorted or filtered. There are no tabs in the content: the global navigation is the only one.
// Loaded jobs stay visible and selectable offline, and their statuses are never changed by the canvas.
export function WorkOrdersContent({ state }: ZoneContentProps) {
  const data = state.data as Wire.WorkOrdersData | undefined;
  const { openWorkOrder } = useShell();
  if (!data) return null;

  return (
    <div className={styles.screen}>
      <h1 className="type-heading-lg">{data.heading}</h1>

      {data.groups.length === 0 ? (
        <Surface role="card" padding={5}>
          <EmptyState title={messages.workOrders.emptyTitle} explanation={messages.workOrders.emptyBody} />
        </Surface>
      ) : (
        data.groups.map((group) => (
          <section key={group.id} className={styles.group} aria-label={group.heading}>
            <h2 className="type-heading-sm">{group.heading}</h2>
            <Surface role="card">
              <div className={styles.card}>
                <RecordList
                  ariaLabel={group.heading}
                  emptyTitle={messages.workOrders.emptyTitle}
                  emptyExplanation={messages.workOrders.emptyBody}
                  records={group.items.map((job) => ({
                    id: job.id,
                    ...(job.time_local ? { timeLocal: job.time_local } : {}),
                    title: job.title,
                    subtitle: job.task,
                    ...(job.status ? { status: job.status } : {}),
                  }))}
                  onSelect={openWorkOrder}
                />
              </div>
            </Surface>
          </section>
        ))
      )}
    </div>
  );
}
