'use client';

import type { Wire } from '@/contracts';
import { Button, Icon, Label, StatusPill, Surface, WidgetContainer, formatSiteLocalTime } from '@/components';
import { logEvent } from '@/runtime/telemetry';
import { messages } from '../messages';
import styles from './Dashboard.module.css';

// The next job: its reference and time, its status, where and what, and one button to open it. An insight or a client note may sit inside it, and
// only when one was supplied (no widget for a job without a supplied insight). The insight is a display-only panel inside this card: headline and
// reason, no buttons, no links, no actions.
export function NextJobCard({ job, onOpen }: { job: Wire.DashboardNextJob; onOpen: () => void }) {
  const time = job.time_local ? formatSiteLocalTime(job.time_local) : null;
  const note = job.note;
  return (
    <div className={styles.jobFrame}>
      <Surface role="card" padding={4} bordered={false}>
        <div className={styles.job}>
          <div className={styles.jobHead}>
            <div>
              <Label text={job.eyebrow} as="p" />
              <p className={`${styles.reference} type-data`}>{time ? `${job.reference} · ${time}` : job.reference}</p>
            </div>
            {job.status && <StatusPill label={job.status.label} tone={job.status.tone} />}
          </div>

          <div className={styles.jobBody}>
            <p className="type-heading-md">{job.title}</p>
            {job.subtitle && <p className="type-body">{job.subtitle}</p>}
            {job.location && <p className={`${styles.muted} type-body-sm`}>{job.location}</p>}
          </div>

          {job.insight != null && (
            <WidgetContainer
              widget={job.insight}
              headerLabel={messages.widget.headerLabel}
              fallbackTitle={messages.widget.fallbackTitle}
              fallbackMessage={messages.widget.fallbackMessage}
              onDiagnostic={(reason) => logEvent(reason === 'unsupported' ? 'widget.unsupported' : reason === 'invalid' ? 'widget.invalid' : 'widget.render_error', 'warn')}
            />
          )}

          {note && (
            <Surface role="panel" padding={3}>
              <div className={styles.note}>
                <span className={styles.noteIcon}>
                  <Icon name="message" size="md" />
                </span>
                <p className="type-body-sm">
                  <strong>{messages.dashboard.noteAt(note.author, note.time_local ? formatSiteLocalTime(note.time_local) : null)}</strong> {note.text}
                </p>
              </div>
            </Surface>
          )}

          <Button label={job.action_label} fullWidth leading={<Icon name="arrow-right" size="md" />} onActivate={onOpen} />
        </div>
      </Surface>
    </div>
  );
}
