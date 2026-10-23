'use client';

import { HistoryList, SectionHeader, StatusPill } from '@/components';
import type { ContextPanelData } from '@/contracts';
import { useHistory } from '@/runtime/history/useHistory';
import { useShell } from '../layout/ShellContext';
import { messages } from '../messages';
import styles from './ContextPanel.module.css';

// The Context Zone content: supporting information that informs the task without being the task (BRD 1.3 section 7).
// Service history arrives in a SUBSEQUENT pass, so the list shows its loading state first and is never blank.
export function ContextPanel({ data }: { data: ContextPanelData }) {
  const { runtime } = useShell();
  const history = useHistory(runtime.history);

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <SectionHeader text={data.title} level={2} size="md" />
        {data.status && <StatusPill label={data.status.label} tone={data.status.tone} />}
      </div>
      {data.lines.map((line) => (
        <p key={line} className="type-body-sm">
          {line}
        </p>
      ))}
      {data.source && <p className={`${styles.muted} type-caption`}>{data.source}</p>}

      <SectionHeader text={data.historyTitle} level={3} size="sm" />
      <HistoryList
        status={history.status}
        records={history.records}
        loadingMore={history.loadingMore}
        hasMore={history.nextCursor !== null}
        degradedMessage={history.degradedMessage}
        ariaLabel={data.historyTitle}
        emptyTitle={messages.history.emptyTitle}
        emptyExplanation={messages.history.emptyBody}
        errorTitle={messages.history.errorTitle}
        errorExplanation={messages.history.errorBody}
        retryLabel={messages.history.retry}
        loadMoreLabel={messages.history.loadMore}
        loadingLabel={messages.history.loading}
        onRetry={() => runtime.history.retry()}
        onRequestMore={() => runtime.history.requestMore()}
      />
    </div>
  );
}
