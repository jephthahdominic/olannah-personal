'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button';
import { DegradedBanner } from '../DegradedBanner/DegradedBanner';
import { EmptyState } from '../EmptyState/EmptyState';
import { Icon } from '../Icon/Icon';
import { Label } from '../Label/Label';
import { Skeleton } from '../Skeleton/Skeleton';
import { useFocusReturn } from '../utils/useFocusReturn';
import { focusFirst, useFocusTrap } from '../utils/useFocusTrap';
import styles from './AssistantPanel.module.css';

export interface AssistantTurnView {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  proactive?: boolean;
}

export interface AssistantLabels {
  title: string;
  trigger: string;
  unreadTrigger: (count: number) => string;
  close: string;
  inputLabel: string;
  send: string;
  userName: string;
  assistantName: string;
  proactive: string;
  emptyTitle: string;
  emptyBody: string;
  loading: string;
  reconnecting: string;
  disconnected: string;
  retry: string;
  submitError?: string;
}

export interface AssistantPanelProps {
  /** The composing layer owns the open state; the panel renders it and asks to change it (BRD 1.2 5.10). */
  open: boolean;
  /** Floating panel on tablet and desktop, bottom sheet on mobile (BRD 1.3 sections 6.6 and 7.1). */
  presentation: 'floating' | 'sheet';
  /** The floating trigger shows on tablet and desktop. On mobile the panel is opened from the More menu instead. */
  showTrigger: boolean;
  /** SUPPLIED render-only cache of turns. The panel renders them and never stores them as authoritative. */
  turns: readonly AssistantTurnView[];
  /** Data dimension: loading before the first delivery, empty when there are no turns yet. */
  data: 'loading' | 'ready' | 'empty';
  /** Runtime dimension (a live relationship): supplied, never inferred. */
  connection: 'connected' | 'reconnecting' | 'disconnected';
  /** Proactive messages that arrived while closed. */
  unread: number;
  /** Controlled draft, owned by the composing layer. */
  draft: string;
  onDraftChange: (draft: string) => void;
  /** `message-submit`: the worker's own words, emitted upward. The panel never calls the intelligence layer. */
  onSubmit: (text: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onRetryConnection: () => void;
  labels: AssistantLabels;
  /** Scroll continuity, handed in and out by the shell's persistence manager (continuity only, never data). */
  initialScrollTop?: number;
  onContinuity?: (c: { scrollTop: number }) => void;
  /** Drawer layer host (z-300). If absent the panel renders in place. */
  portalTarget?: HTMLElement | null;
}

// A SECONDARY surface: never the primary interaction model, never visible by default, never occupying primary zone space,
// and never displacing context or content when open (BRD 1.3 section 7.1). It is persistence-capable, but the SHELL decides
// whether an instance actually persists; the panel never elects itself (BRD 1.2 5.4).
export function AssistantPanel(p: AssistantPanelProps) {
  const root = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lastScroll = useRef(0);
  const onKeyDown = useFocusTrap(root, p.onClose);
  useFocusReturn(p.open, () => trigger.current);

  // Restore scroll continuity on mount; report it on unmount so the shell can keep it across a layout change.
  const { initialScrollTop, onContinuity } = p;
  useEffect(() => {
    if (p.open && log.current && initialScrollTop) log.current.scrollTop = initialScrollTop;
    return () => {
      if (p.open) onContinuity?.({ scrollTop: lastScroll.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on open/close only, not on every scroll
  }, [p.open]);

  useEffect(() => {
    if (p.open) focusFirst(root.current);
  }, [p.open]);

  // Keep the newest turn in view.
  useEffect(() => {
    if (p.open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [p.turns.length, p.open]);

  const connected = p.connection === 'connected';
  const canSend = connected && p.draft.trim().length > 0;

  const unreadLabel = p.unread > 0 ? p.labels.unreadTrigger(p.unread) : p.labels.trigger;
  // The trigger stays MOUNTED and is only hidden while the panel is open. Unmounting it would remove the focused element
  // before focus return can record it, and keyboard focus would be lost when the panel closes (BRD 1.3 section 11.2).
  const closedTrigger = p.showTrigger ? (
      <button ref={trigger} type="button" className={styles.trigger} hidden={p.open} aria-label={unreadLabel} aria-haspopup="dialog" aria-expanded={false} onClick={p.onOpen}>
        <Icon name="sparkles" size="lg" />
        {p.unread > 0 && (
          <span className={`${styles.badge} type-caption`} aria-hidden="true">
            {p.unread}
          </span>
        )}
      </button>
    ) : null;

  const panel = p.open ? (
    <div className={`${styles.root} ${p.presentation === 'sheet' ? styles.sheetRoot : ''}`} onKeyDown={onKeyDown}>
      {p.presentation === 'sheet' && <div className={styles.overlay} onClick={p.onClose} aria-hidden="true" data-testid="assistant-overlay" />}
      <div ref={root} className={`${styles.panel} ${p.presentation === 'sheet' ? styles.sheet : styles.floating}`} role="dialog" aria-label={p.labels.title} aria-modal={p.presentation === 'sheet' || undefined}>
        <div className={styles.header}>
          <span className="type-heading-md">{p.labels.title}</span>
          <button type="button" className={styles.close} aria-label={p.labels.close} onClick={p.onClose}>
            <Icon name="x" size="md" />
          </button>
        </div>

        {p.connection !== 'connected' && (
          <div className={styles.banner}>
            <DegradedBanner
              message={p.connection === 'reconnecting' ? p.labels.reconnecting : p.labels.disconnected}
              severity={p.connection === 'reconnecting' ? 'warning' : 'error'}
              {...(p.connection === 'disconnected' ? { actionLabel: p.labels.retry, onAction: p.onRetryConnection } : {})}
            />
          </div>
        )}

        <div
          ref={log}
          className={styles.log}
          role="log"
          aria-live="polite"
          aria-label={p.labels.title}
          tabIndex={0}
          onScroll={(e) => void (lastScroll.current = e.currentTarget.scrollTop)}
        >
          {p.data === 'loading' && (
            <div role="status" aria-busy="true" aria-label={p.labels.loading}>
              <Skeleton shape="body" />
              <Skeleton shape="body-short" />
            </div>
          )}
          {p.data === 'empty' && <EmptyState title={p.labels.emptyTitle} explanation={p.labels.emptyBody} />}
          {p.data === 'ready' &&
            p.turns.map((t) => (
              <div key={t.id} className={`${styles.turn} ${t.role === 'user' ? styles.user : styles.assistant}`}>
                <Label text={t.role === 'user' ? p.labels.userName : p.labels.assistantName} as="p" />
                {t.proactive && <p className={`${styles.proactive} type-caption`}>{p.labels.proactive}</p>}
                <p className="type-body">{t.text}</p>
              </div>
            ))}
        </div>

        <form
          className={styles.compose}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) p.onSubmit(p.draft);
          }}
        >
          {p.labels.submitError && (
            <p className={`${styles.error} type-body-sm`} role="alert">
              {p.labels.submitError}
            </p>
          )}
          <label htmlFor="assistant-input" className="type-label">
            {p.labels.inputLabel}
          </label>
          <div className={styles.row}>
            <input
              id="assistant-input"
              className={`${styles.input} type-body`}
              value={p.draft}
              maxLength={2000}
              autoComplete="off"
              onChange={(e) => p.onDraftChange(e.target.value)}
            />
            <Button type="submit" label={p.labels.send} disabled={!canSend} leading={<Icon name="send" size="md" />} />
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const content = (
    <>
      {closedTrigger}
      {panel}
    </>
  );
  return p.portalTarget ? createPortal(content, p.portalTarget) : content;
}
