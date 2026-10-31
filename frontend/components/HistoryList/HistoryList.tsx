'use client';

import { useEffect, useRef } from 'react';
import { DegradedBanner } from '../DegradedBanner/DegradedBanner';
import { EmptyState } from '../EmptyState/EmptyState';
import { InlineError } from '../InlineError/InlineError';
import { Skeleton } from '../Skeleton/Skeleton';
import { Button } from '../Button/Button';
import { StatusPill } from '../StatusPill/StatusPill';
import { formatSiteLocalDate } from '../utils/formatSiteLocal';
import styles from './HistoryList.module.css';

export interface HistoryItem {
  id: string;
  /** Site-local "YYYY-MM-DD". Formatted, never converted. */
  occurredOn: string;
  title: string;
  summary?: string;
  /** SUPPLIED status text, shown as given. Never derived. */
  status?: string;
  /** SUPPLIED flags (for example "recurring issue"), shown as given. */
  flags?: readonly string[];
  /** SUPPLIED names of the systems this record came from, shown as given. */
  sources?: readonly string[];
}

export type HistoryListStatus = 'loading' | 'ready' | 'empty' | 'degraded' | 'error';

export interface HistoryListProps {
  /** The condition of the history as supplied: loading, ready, empty, degraded or error. The list never works it out. */
  status: HistoryListStatus;
  /** The past records, in the order supplied. */
  records: readonly HistoryItem[];
  /** True while a further page is being fetched. */
  loadingMore: boolean;
  /** True when more records exist. The list never decides this: it is supplied. */
  hasMore: boolean;
  /** The accessible name of the list. */
  ariaLabel: string;
  /** Supplied by upstream when the history is partial. Never inferred. */
  degradedMessage?: string;
  /** Supplied explanations for the empty and error states. */
  emptyTitle: string;
  /** Why there is no history. Supplied text, never blank. */
  emptyExplanation: string;
  /** The heading shown when history could not be loaded. Supplied text. */
  errorTitle: string;
  /** What went wrong and what the worker can do, in plain words. Supplied text. */
  errorExplanation: string;
  /** The label of the retry action in the error state. */
  retryLabel: string;
  /** The label of the control that asks for more records. */
  loadMoreLabel: string;
  /** Visible lead-ins for the optional status and sources lines. Required only when records carry them. */
  statusLabel?: string;
  /** The heading above a record's sources, such as "From". */
  sourcesLabel?: string;
  /** The accessible message announced while history loads. */
  loadingLabel: string;
  /** Called when the worker asks to try loading history again. */
  onRetry: () => void;
  /** `request-more`: asked for as the end of the list scrolls into view. The canvas relays it; the list fetches nothing. */
  onRequestMore: () => void;
}

// History is delivered in a subsequent pass, so the list renders its LOADING state first and is never blank between the
// first render and delivery (BRD 1.2 5.6 Feature 3). It loads progressively on scroll rather than paginating (1.3 §6.8).
export function HistoryList(p: HistoryListProps) {
  const sentinel = useRef<HTMLLIElement>(null);
  const canObserve = typeof IntersectionObserver !== 'undefined';

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canObserve || !p.hasMore || p.loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) p.onRequestMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onRequestMore is a stable relay; re-observe only when paging state changes
  }, [p.hasMore, p.loadingMore, p.records.length, canObserve]);

  if (p.status === 'loading') {
    return (
      <div className={styles.skeleton} role="status" aria-busy="true" aria-label={p.loadingLabel}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton shape="field-label" />
            <Skeleton shape="body" />
          </div>
        ))}
      </div>
    );
  }
  if (p.status === 'error') {
    return <InlineError title={p.errorTitle} body={p.errorExplanation} retryLabel={p.retryLabel} onRetry={p.onRetry} />;
  }
  if (p.status === 'empty') return <EmptyState title={p.emptyTitle} explanation={p.emptyExplanation} />;

  return (
    <div className={styles.wrap}>
      {p.status === 'degraded' && p.degradedMessage && <DegradedBanner message={p.degradedMessage} />}
      <ul className={styles.list} aria-label={p.ariaLabel}>
        {p.records.map((r) => (
          <li key={r.id} className={styles.item}>
            <span className="type-label">{formatSiteLocalDate(r.occurredOn)}</span>
            <span className="type-heading-sm">{r.title}</span>
            {r.summary && <span className={`${styles.summary} type-body-sm`}>{r.summary}</span>}
            {r.flags && r.flags.length > 0 && (
              <span className={styles.flags}>
                {r.flags.map((flag) => (
                  <StatusPill key={flag} label={flag} tone="neutral" />
                ))}
              </span>
            )}
            {(r.status || (r.sources && r.sources.length > 0)) && (
              <span className={`${styles.meta} type-body-sm`}>
                {r.status && <span>{p.statusLabel ? `${p.statusLabel}: ${r.status}` : r.status}</span>}
                {r.sources && r.sources.length > 0 && <span>{p.sourcesLabel ? `${p.sourcesLabel}: ${r.sources.join(', ')}` : r.sources.join(', ')}</span>}
              </span>
            )}
          </li>
        ))}
        {p.hasMore && <li ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
      </ul>
      {p.loadingMore && (
        <div className={styles.skeletonRow} role="status" aria-busy="true" aria-label={p.loadingLabel}>
          <Skeleton shape="field-label" />
          <Skeleton shape="body" />
        </div>
      )}
      {/* Scroll loading cannot be reached by keyboard or assistive technology, and some browsers lack the observer. */}
      {p.hasMore && !p.loadingMore && !canObserve && <Button label={p.loadMoreLabel} variant="ghost" onActivate={p.onRequestMore} />}
    </div>
  );
}
