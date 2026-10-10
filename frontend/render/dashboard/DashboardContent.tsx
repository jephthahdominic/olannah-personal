'use client';

import { Button, Label, RecordList, SectionHeader, StatTile, StatusIndicator, StatusPill, Surface, formatSiteLocalTime } from '@/components';
import type { DashboardData } from '@/contracts';
import { useShell } from '../layout/ShellContext';
import { messages } from '../messages';
import styles from './DashboardContent.module.css';

// The Dashboard (BRD 1.1: the universal landing destination). Everything shown is SUPPLIED in the zone payload: the
// headline, the figures, the labels, the status text. The canvas formats site-local times and arranges components; it
// computes no count, no greeting and no status (BRD 1.2 5.2 Feature 7). The layout follows the approved designs.
export function DashboardContent({ data }: { data: DashboardData }) {
  const { navigate } = useShell();
  const featured = data.featured ?? null;

  return (
    <div className={styles.dashboard}>
      <SectionHeader text={data.headline} level={2} size="lg" />

      {data.notice && (
        <div className={`${styles.notice} ${styles[data.notice.tone]}`} role="status">
          <StatusIndicator state={data.notice.tone === 'success' ? 'success' : 'inactive'} label={data.notice.title} decorative size="lg" />
          <div>
            <p className="type-heading-sm">{data.notice.title}</p>
            <p className={`${styles.muted} type-body-sm`}>{data.notice.body}</p>
          </div>
        </div>
      )}

      <section className={styles.section} aria-labelledby="summary-title">
        <SectionHeader id="summary-title" text={data.summaryTitle} level={3} size="md" />
        <div className={styles.tiles}>
          {data.summary.map((tile) => (
            <StatTile key={tile.id} label={tile.label} value={tile.value} caption={tile.caption} tone={tile.tone} />
          ))}
        </div>
      </section>

      {featured && (
        <Surface role="card" padding={4} className={styles.featured}>
          <div className={styles.featuredHead}>
            <div>
              <Label text={featured.eyebrow} as="p" />
              <p className={`${styles.reference} type-data`}>
                {featured.reference}
                {featured.timeLocal && <> · {formatSiteLocalTime(featured.timeLocal)}</>}
              </p>
            </div>
            {featured.status && <StatusPill label={featured.status.label} tone={featured.status.tone} />}
          </div>
          <p className="type-heading-lg">{featured.title}</p>
          {featured.subtitle && <p className="type-body">{featured.subtitle}</p>}
          {featured.location && <p className={`${styles.muted} type-body-sm`}>{featured.location}</p>}
          {featured.note && (
            <p className={`${styles.note} type-body-sm`}>
              <strong>{messages.dashboard.noteBy(featured.note.author)}</strong> {featured.note.text}
            </p>
          )}
          <Button label={featured.actionLabel} fullWidth onActivate={() => navigate('work-orders')} />
        </Surface>
      )}

      <section className={styles.section} aria-labelledby="queue-title">
        <SectionHeader id="queue-title" text={data.queueTitle} level={3} size="md" trailing={data.queueCaption && <span className={`${styles.muted} type-body-sm`}>{data.queueCaption}</span>} />
        <Surface role="card" padding={3} className={styles.queue}>
          <RecordList
            records={data.queue}
            ariaLabel={data.queueTitle}
            emptyTitle={messages.dashboard.queueEmptyTitle}
            emptyExplanation={messages.dashboard.queueEmptyBody}
          />
        </Surface>
      </section>
    </div>
  );
}
