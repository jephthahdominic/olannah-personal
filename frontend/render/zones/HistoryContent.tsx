'use client';

import { HistoryList } from '@/components';
import { useHistory } from '@/runtime/history/useHistory';
import { useShell } from '../layout/ShellContext';
import { messages } from '../messages';

// The history zone content. History arrives in a SUBSEQUENT pass, so the list shows its own loading state first and is never blank.
// The records are exactly the aggregator's: this view fetches nothing, it renders what the runtime hydrated (BRD UR9C).
export function HistoryContent() {
  const { runtime } = useShell();
  const history = useHistory(runtime.history);
  return (
    <HistoryList
      status={history.status}
      records={history.records.map((r) => ({ id: r.id, occurredOn: r.date, title: r.title, status: r.status, flags: r.flags, sources: r.sources }))}
      loadingMore={false}
      hasMore={false}
      degradedMessage={history.unavailableSources.length > 0 ? messages.history.partial : undefined}
      ariaLabel={messages.zones.history.title}
      emptyTitle={messages.history.emptyTitle}
      emptyExplanation={messages.history.emptyBody}
      errorTitle={messages.history.errorTitle}
      errorExplanation={messages.history.errorBody}
      retryLabel={messages.history.retry}
      loadMoreLabel={messages.history.loadMore}
      loadingLabel={messages.history.loading}
      statusLabel={messages.history.status}
      sourcesLabel={messages.history.sources}
      onRetry={() => runtime.history.retry()}
      onRequestMore={() => {}}
    />
  );
}
