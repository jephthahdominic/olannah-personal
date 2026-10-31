'use client';

import type { Wire } from '@/contracts';
import { DegradedBanner, EmptyState, StatTile, StatusIndicator, Surface } from '@/components';
import { useShell } from '../layout/ShellContext';
import type { ZoneContentProps } from '../layout/registry';
import { messages } from '../messages';
import { NextJobCard } from './NextJobCard';
import { ScheduleGroup } from './ScheduleGroup';
import styles from './Dashboard.module.css';

// The Dashboard (approved design 03). Everything it shows is SUPPLIED with the zone: the greeting, the date, the counts and their shapes, the
// next job, the schedule, the headings and the button label. The canvas formats site-local times and arranges components. It computes no
// greeting, no count and no status (BRD 1.2 5.2 Feature 7).
//
// States, each from the design:
//   ready          the greeting, three counts, the next job, today and tomorrow.
//   no jobs        the same counts (zeros, with no shapes), and one empty card in place of the job and the lists.
//   refreshing     "Your jobs" with "Updating" beside it. The rows already loaded stay where they are.
//   30 seconds     "Your jobs", and a plain warning that they may not be current. It does not claim the data is stale: it says freshness cannot be
//                  guaranteed (BRD 1.0 UR7B).
// The lost connection and a revoked screen are the shell's banners above this content, not this component's.
export function DashboardContent({ state }: ZoneContentProps) {
  const data = state.data as Wire.DashboardData | undefined;
  const { openWorkOrder } = useShell();
  if (!data) return null;
  const hasSchedule = data.today !== null || data.tomorrow !== null;
  const empty = data.next_job === null && !hasSchedule;

  return (
    <div className={styles.dashboard}>
      <header className={styles.greeting}>
        <h1 className="type-heading-lg">{data.greeting}</h1>
        <p className={`${styles.date} type-body-sm`}>{data.date}</p>
      </header>

      {(state.refreshing || state.refreshDelayed) && (
        <div className={styles.jobsRow}>
          <h2 className="type-heading-md">{data.jobs_heading}</h2>
          {state.refreshing && !state.refreshDelayed && (
            <p className={`${styles.updating} type-body-sm`} role="status">
              <StatusIndicator state="loading" label={messages.dashboard.updating} decorative size="sm" />
              {messages.dashboard.updating}
            </p>
          )}
        </div>
      )}
      {state.refreshing && state.refreshDelayed && <DegradedBanner message={messages.dashboard.freshnessWarning} />}

      <div className={styles.counts} role="group" aria-label={data.jobs_heading}>
        {data.counts.map((count) => (
          <StatTile key={count.id} label={count.label} value={count.value} status={count.status} />
        ))}
      </div>

      {data.next_job && <NextJobCard job={data.next_job} onOpen={() => openWorkOrder(data.next_job!.reference)} />}

      {empty && (
        <Surface role="card" padding={5}>
          <EmptyState title={messages.dashboard.emptyTitle} explanation={messages.dashboard.emptyBody} />
        </Surface>
      )}

      {data.today && <ScheduleGroup group={data.today} onSelect={openWorkOrder} />}
      {data.tomorrow && <ScheduleGroup group={data.tomorrow} onSelect={openWorkOrder} />}
    </div>
  );
}
