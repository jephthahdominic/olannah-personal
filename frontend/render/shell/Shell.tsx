'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, DegradedBanner, Label, MoreMenu, SectionHeader, Surface } from '@/components';
import type { ContextEnvelope, ScreenContext } from '@/contracts';
import type { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import { useConnection } from '@/runtime/canvas/useCanvasRuntime';
import type { DeepReadonly } from '@/runtime/freeze';
import { liveRegion } from '@/runtime/liveRegion';
import type { CheckpointController } from '@/runtime/checkpoint/checkpointController';
import { registerPurgeHandler } from '@/runtime/purgeSession';
import type { ResolvedLayout } from '@/runtime/boot/layoutRegistry';
import { logEvent } from '@/runtime/telemetry';
import { toastStore } from '@/runtime/toasts';
import { useViewport } from '@/runtime/viewport';
import { CONTEXT_ZONE, primaryZoneKey } from '@/runtime/zones/zoneKeys';
import { useZoneFreshness } from '@/runtime/zones/useZoneFreshness';
import { ShellContext, type ShellContextValue } from '../layout/ShellContext';
import { getTemplate } from '../layout/templates';
import { ZoneHost } from '../layout/ZoneHost';
import { messages } from '../messages';
import { NavigationZone } from '../navigation/NavigationZone';
import { destinationIdForPath, routeForDestination } from '../navigation/routing';
import { useNavigation } from '../navigation/useNavigation';
import { AssistantHost } from '../assistant/AssistantHost';
import { CheckpointHost } from '../checkpoint/CheckpointHost';
import { useBlockingScope } from '../checkpoint/useBlockingScope';
import { FeedbackHost } from '../feedback/FeedbackHost';
import { LiveRegions } from './LiveRegions';
import { PortalHosts } from './PortalHosts';
import { SettingsScreen } from './SettingsScreen';
import { ToastHost } from './ToastHost';
import { Topbar } from './Topbar';
import styles from './Shell.module.css';

interface ShellProps {
  context: DeepReadonly<ContextEnvelope>;
  layout: ResolvedLayout;
  /** Owns the bus connection, update pipeline, refresh and history. The shell only reads its state. */
  runtime: CanvasRuntime;
  signOut: () => void;
  /** Where "contact support" goes. Supplied by runtime configuration. */
  supportHref: string;
  toastDurationMs?: number;
  /** The checkpoint controller, created by the app layer. While it is active the whole canvas root is inert and only the
   *  checkpoint surface is interactive (BRD 1.2 5.12 Feature 6). */
  checkpoint?: CheckpointController;
  /** Development tools (mock fault injection), supplied by the app layer so the render path never imports the mocks. */
  devTools?: ReactNode;
}

// The canvas shell: assembles the workspace from the context object (BRD 1.0). It composes; it decides nothing about
// business meaning. Layout comes from a template (data), navigation from the pure assembly function, and every zone is
// isolated behind its own host.
export function Shell({ context, layout, runtime, signOut, supportHref, toastDurationMs, checkpoint, devTools }: ShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const viewport = useViewport();
  const template = useMemo(() => getTemplate(layout.layoutId), [layout.layoutId]);
  const connection = useConnection(runtime);
  const blocked = useSyncExternalStore(
    (listener) => checkpoint?.subscribe(listener) ?? (() => {}),
    () => checkpoint?.isActive() ?? false,
    () => false,
  );
  useBlockingScope(blocked);

  const [menuOpen, setMenuOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [moreTarget, setMoreTarget] = useState<HTMLDivElement | null>(null);
  const [toastTarget, setToastTarget] = useState<HTMLDivElement | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<HTMLDivElement | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Where the assistant was opened. The SHELL decides whether it persists across a layout change (BRD 1.0 SR17): an elected
  // instance keeps one scope and stays open as the worker navigates; an ephemeral one is scoped to the destination it was opened
  // on, so navigating away releases it.
  const [assistantOpenAt, setAssistantOpenAt] = useState<string | null>(null);

  useEffect(
    () =>
      registerPurgeHandler(() => {
        runtime.zones.clear();
        toastStore.clear();
        liveRegion.clear();
      }),
    [runtime],
  );

  const activeId = destinationIdForPath(pathname);
  const assistantScope = runtime.persistence.isElected('AssistantPanel', true) ? 'persistent' : (activeId ?? 'none');
  const assistantOpen = assistantOpenAt === assistantScope;
  const { model } = useNavigation(context, viewport, activeId);
  const allItems = useMemo(() => [...model.items, ...model.overflow], [model]);
  const activeLabel = allItems.find((i) => i.id === activeId)?.label ?? null;

  const go = useCallback(
    (id: string) => {
      const route = routeForDestination(id);
      if (route) router.push(route);
    },
    [router],
  );

  const onSelect = useCallback(
    (id: string) => {
      if (id === 'more') return setMenuOpen((open) => !open);
      const item = allItems.find((i) => i.id === id);
      if (item?.unavailable) {
        // An unavailable destination stays discoverable but activates to an explanation, never a route change.
        logEvent('nav.offline_unavailable_selected', 'info');
        toastStore.push(item.unavailableReason ?? messages.nav.unavailableReason);
        return;
      }
      setMenuOpen(false);
      go(id);
    },
    [allItems, go],
  );

  const onMoreAction = useCallback(
    (id: string) => {
      setMenuOpen(false);
      if (id === 'settings') return go('settings');
      if (id === 'ask') return setAssistantOpenAt(assistantScope);
      if (id === 'feedback') return setFeedbackOpen(true);
    },
    [go, assistantScope],
  );

  // A zone's "try again" asks the context channel to re-deliver. The result flows through the normal update pipeline.
  const retryZone = useCallback(() => void runtime.refreshAll(), [runtime]);

  const shellValue = useMemo<ShellContextValue>(
    () => ({ layoutId: layout.layoutId, viewport, worker: context.worker, activeLabel, signOut, runtime, navigate: go }),
    [layout.layoutId, viewport, context.worker, activeLabel, signOut, runtime, go],
  );

  const primaryKey = primaryZoneKey(activeId);
  const watchedKeys = useMemo(() => [primaryKey, CONTEXT_ZONE], [primaryKey]);
  // The screen context for feedback is captured automatically, as structured data. No screenshot, no values (SDD 15.3).
  const screenContext: ScreenContext = {
    destinationId: activeId,
    layoutId: layout.layoutId,
    viewport,
    zones: watchedKeys.map((zone) => ({ zone, condition: runtime.zones.get(zone).condition })),
  };
  const freshness = useZoneFreshness(runtime.zones, watchedKeys, connection);

  const workspaceLabel =
    messages.shell.workspaceLabel[layout.layoutId as keyof typeof messages.shell.workspaceLabel] ?? messages.shell.workspaceLabel.default;
  const placements = template.placements[viewport];
  const zoneFor = (zoneId: string) => template.zones.find((z) => z.id === zoneId);
  const mainZone = zoneFor(placements.find((p) => p.region === 'main')?.zoneId ?? 'primary');
  const sideZone = zoneFor(placements.find((p) => p.region === 'aside')?.zoneId ?? '');
  const collapsibleZone = zoneFor(placements.find((p) => p.region === 'collapsible')?.zoneId ?? '');

  const moreActions = [
    { id: 'ask', icon: 'sparkles' as const, ...messages.nav.moreActions.ask },
    { id: 'feedback', icon: 'message' as const, ...messages.nav.moreActions.feedback },
    { id: 'settings', icon: 'settings' as const, ...messages.nav.moreActions.settings },
  ];

  const navigation = (
    <NavigationZone viewport={viewport} items={model.items} onSelect={onSelect} menuOpen={menuOpen} onDashboard={() => go('dashboard')} />
  );

  return (
    <ShellContext.Provider value={shellValue}>
      <div data-canvas-root className={`${styles.shell} ${styles[viewport]}`} data-viewport={viewport}>
        <a className={styles.skip} href="#primary-content">
          {messages.nav.skipToContent}
        </a>

        <Topbar layoutId={layout.layoutId} worker={context.worker} viewport={viewport} freshness={freshness} connection={connection} onFeedback={() => setFeedbackOpen(true)} />

        <div className={styles.body}>
          {/* Focus order follows document order: navigation, then primary content, then context (BRD 1.3 section 11.2). */}
          {viewport !== 'mobile' && <div className={styles.navRail}>{navigation}</div>}

          <main id="primary-content" tabIndex={-1} className={styles.main}>
            {/* The connection banner persists until the connection is restored and never obscures zone content. */}
            {connection === 'reconnecting' && <DegradedBanner message={messages.connection.lost} />}
            {connection === 'failed' && (
              <DegradedBanner
                message={messages.connection.failed}
                severity="error"
                actionLabel={messages.connection.retry}
                onAction={() => runtime.retryConnection()}
                secondaryLabel={messages.connection.contactSupport}
                secondaryHref={supportHref}
              />
            )}

            <div className={styles.pageHeader}>
              <Label text={workspaceLabel} />
              {activeLabel && <SectionHeader text={activeLabel} level={1} size="lg" />}
            </div>
            {activeId === 'settings' ? (
              <Surface role="card" padding={5}>
                <SettingsScreen />
              </Surface>
            ) : (
              mainZone && <ZoneHost key={primaryKey} spec={mainZone} zoneKey={primaryKey} store={runtime.zones} onRetry={retryZone} />
            )}

            {collapsibleZone && (
              <section className={styles.collapsible} aria-label={messages.zone.contextTitle}>
                <Button
                  label={contextOpen ? messages.zone.hideContext : messages.zone.showContext}
                  variant="ghost"
                  fullWidth
                  onActivate={() => setContextOpen((o) => !o)}
                />
                <div id="context-zone" hidden={!contextOpen}>
                  <ZoneHost spec={collapsibleZone} zoneKey={CONTEXT_ZONE} store={runtime.zones} onRetry={retryZone} />
                </div>
              </section>
            )}
          </main>

          {sideZone && (
            <aside className={styles.aside} aria-label={messages.zone.contextTitle}>
              <ZoneHost spec={sideZone} zoneKey={CONTEXT_ZONE} store={runtime.zones} onRetry={retryZone} />
            </aside>
          )}
        </div>

        {viewport === 'mobile' && <div className={styles.tabBar}>{navigation}</div>}

        {viewport === 'mobile' && (
          <MoreMenu
            open={menuOpen}
            actions={moreActions}
            overflowDestinations={model.overflow}
            onCloseRequest={() => setMenuOpen(false)}
            onActionSelect={onMoreAction}
            onDestinationSelect={onSelect}
            portalTarget={moreTarget}
          />
        )}

        <PortalHosts setMoreMenu={setMoreTarget} setToast={setToastTarget} setDrawer={setDrawerTarget} />
        {/* Secondary surfaces on the drawer layer. Neither occupies primary zone space or displaces context. */}
        <AssistantHost
          key={assistantScope}
          runtime={runtime}
          open={assistantOpen}
          onOpen={() => setAssistantOpenAt(assistantScope)}
          onClose={() => setAssistantOpenAt(null)}
          presentation={viewport === 'mobile' ? 'sheet' : 'floating'}
          showTrigger={viewport !== 'mobile'}
          portalTarget={drawerTarget}
        />
        <FeedbackHost
          runtime={runtime}
          open={feedbackOpen}
          onDismiss={() => setFeedbackOpen(false)}
          presentation={viewport === 'mobile' ? 'sheet' : 'popover'}
          screen={screenContext}
          screenSummary={messages.feedback.summary(activeLabel ?? messages.feedback.thisScreen, viewport)}
          portalTarget={drawerTarget}
        />
        <ToastHost target={toastTarget} durationMs={toastDurationMs} />
        <LiveRegions />
        {devTools}
      </div>
      {/* A SIBLING of the canvas root, so it stays interactive while the root is inert. It renders nothing unless a checkpoint exists. */}
      {checkpoint && <CheckpointHost controller={checkpoint} connection={connection} />}
    </ShellContext.Provider>
  );
}
