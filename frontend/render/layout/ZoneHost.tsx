'use client';

import { Suspense, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { DegradedBanner, EmptyState, InlineError, Skeleton, StatusIndicator, Surface, SyncDot } from '@/components';
import type { ZoneState, ZoneStore } from '@/runtime/zones/zoneStore';
import { logEvent } from '@/runtime/telemetry';
import { ErrorBoundary } from './ErrorBoundary';
import { resolveComponent } from './registry';
import type { ZoneSpec } from './types';
import { messages } from '../messages';
import styles from './ZoneHost.module.css';

// The zone host gives each zone its own error boundary, suspense boundary, store-slice subscription, and render probe
// (SDD 6.5). Because each zone subscribes only to its own slice, an event for one zone does not re-render the others,
// and a throw in one zone cannot propagate past its boundary.

interface ZoneHostProps {
  spec: ZoneSpec;
  /** The store key for this zone's payload. The primary zone shows a different payload per destination. Defaults to the zone id. */
  zoneKey?: string;
  store: ZoneStore;
  /** Asks the shell to request this zone again. */
  onRetry: (zoneKey: string) => void;
  labelledBy?: string;
}

export function ZoneHost({ spec, zoneKey = spec.id, store, onRetry, labelledBy }: ZoneHostProps) {
  const retry = spec.unavailable.retry ? () => onRetry(zoneKey) : undefined;

  return (
    <Surface role={spec.surface} padding={5} className={styles.zone}>
      <ErrorBoundary
        onError={() => {
          // A render failure inside this zone degrades THIS zone only.
          logEvent('zone.unavailable', 'error', 'render_error');
          store.markUnavailable(zoneKey);
        }}
        fallback={(reset) => (
          <UnavailableState
            spec={spec}
            onRetry={() => {
              onRetry(zoneKey);
              reset();
            }}
          />
        )}
      >
        <Suspense fallback={<ZoneSkeleton role={spec.role} />}>
          <ZoneBody spec={spec} zoneKey={zoneKey} store={store} onRetry={retry} labelledBy={labelledBy} />
        </Suspense>
      </ErrorBoundary>
    </Surface>
  );
}

function ZoneBody({ spec, zoneKey, store, onRetry, labelledBy }: { spec: ZoneSpec; zoneKey: string; store: ZoneStore; onRetry?: () => void; labelledBy?: string }) {
  const subscribe = useMemo(() => store.subscribe(zoneKey), [store, zoneKey]);
  const state = useSyncExternalStore(
    subscribe,
    () => store.get(zoneKey),
    () => store.get(zoneKey),
  );

  // Render confirmation. After React commits a new version, tell the store it is on screen. ONLY now may the refreshing
  // indicator clear (BRD 1.0 UR7C): clearing earlier is a test failure. This is also the render probe for the 400ms and
  // 700ms targets (SDD 13.4).
  useEffect(() => {
    if (state.condition === 'scaffolded') return;
    store.markRendered(zoneKey, state.version);
    if (typeof performance !== 'undefined') performance.mark(`zone_render_complete:${zoneKey}`);
  }, [state.condition, state.version, store, zoneKey]);

  return (
    <div className={styles.body} data-zone={spec.id} data-condition={state.condition} data-refreshing={state.refreshing || undefined} aria-labelledby={labelledBy} aria-busy={state.condition === 'scaffolded' || state.refreshing}>
      <RefreshIndicator state={state} onRetry={onRetry} />
      <ZoneState_ spec={spec} state={state} onRetry={onRetry} />
    </div>
  );
}

function ZoneState_({ spec, state, onRetry }: { spec: ZoneSpec; state: ZoneState; onRetry?: () => void }): ReactNode {
  switch (state.condition) {
    case 'scaffolded':
      return <ZoneSkeleton role={spec.role} />;
    case 'unavailable':
      return <UnavailableState spec={spec} message={state.message} onRetry={onRetry} />;
    case 'empty':
      return <EmptyState title={spec.empty.title} explanation={spec.empty.body} />;
    case 'stale':
    case 'rendered':
      return (
        <>
          {state.degraded && state.message && <DegradedBanner message={state.message} />}
          {spec.content.map((name) => {
            const Content = resolveComponent(name);
            return Content ? <Content key={name} zone={spec} state={state} /> : null;
          })}
        </>
      );
  }
}

// Refreshing shows immediately and clears only after the new data renders. After the warning threshold it becomes a
// warning (BRD 1.0 UR7B): freshness can no longer be guaranteed, which is not the same as the data being wrong. A stale
// zone (its connection was lost) says so with text and a hollow-or-amber marker, never color alone.
function RefreshIndicator({ state, onRetry }: { state: ZoneState; onRetry?: () => void }) {
  if (state.refreshing && state.refreshDelayed) {
    return <DegradedBanner message={messages.zone.refreshDelayed} {...(onRetry ? { actionLabel: messages.zone.retry, onAction: onRetry } : {})} />;
  }
  if (state.refreshing) {
    return (
      <p className={`${styles.refreshing} type-caption`} role="status">
        <StatusIndicator state="loading" label={messages.zone.refreshing} decorative size="sm" />
        {messages.zone.refreshing}
      </p>
    );
  }
  if (state.condition === 'stale') return <SyncDot freshness="stale" connectivity="connected" label={messages.zone.stale} />;
  return null;
}

function UnavailableState({ spec, message, onRetry }: { spec: ZoneSpec; message?: string; onRetry?: () => void }) {
  return (
    <InlineError
      title={spec.unavailable.title}
      // Supplied text wins; otherwise the zone's registered text. Never a code, never generated here.
      body={message ?? spec.unavailable.body}
      {...(spec.unavailable.retry && onRetry ? { retryLabel: messages.zone.retry, onRetry } : {})}
    />
  );
}

function ZoneSkeleton({ role }: { role: ZoneSpec['role'] }) {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton shape="title" />
      {role === 'primary' ? (
        <>
          <Skeleton shape="card" cardHeight="md" />
          <Skeleton shape="body" />
          <Skeleton shape="body-short" />
        </>
      ) : (
        <>
          <Skeleton shape="context-row" />
          <Skeleton shape="context-row" />
          <Skeleton shape="context-row" />
        </>
      )}
    </div>
  );
}
