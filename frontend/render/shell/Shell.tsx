'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, DegradedBanner, EmptyState, InlineError, MoreMenu, Surface } from '@/components';
import { ZONE_IDS, type ScreenContext, type Wire } from '@/contracts';
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
import { ContextHeader } from './ContextHeader';
import { PageBand } from './PageBand';
import { LiveRegions } from './LiveRegions';
import { PortalHosts } from './PortalHosts';
import { SettingsScreen } from './SettingsScreen';
import { ToastHost } from './ToastHost';
import { Topbar } from './Topbar';
import styles from './Shell.module.css';

interface ShellProps {
  context: DeepReadonly<Wire.ValidatedContext>;
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
export function Shell({ context, layout, runtime, signOut, toastDurationMs, checkpoint, devTools }: ShellProps) {
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
  const connectionLost = connection === 'reconnecting' || connection === 'failed';
  // The work order hub is reached from Work Orders and has no item of its own, so Work Orders stays the active destination while the worker is in it.
  const { model } = useNavigation(context, viewport, activeId === 'work-order' ? 'jobs' : activeId, connectionLost);
  const allItems = useMemo(() => [...model.items, ...model.overflow], [model]);
  const activeLabel = allItems.find((i) => i.destinationId === activeId)?.label ?? null;

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
      const item = allItems.find((i) => i.destinationId === id);
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

  // Access to the screen the worker was on was removed (BRD 1.0 SR25): take them to Dashboard, the platform safe destination, and keep the
  // supplied message until they dismiss it. The navigation set is not changed: the canvas is not an authorization boundary.
  const revocation = useSyncExternalStore(runtime.subscribeRevocation, runtime.getRevocation, () => null);
  useEffect(() => {
    if (revocation && activeId !== 'dashboard') go('dashboard');
  }, [revocation, activeId, go]);

  // The canvas holds the full detail of the ACTIVE work order only. Any other job says its detail is not available yet, rather than showing the
  // wrong job. (How another job's detail is delivered is not defined yet.)
  const activeWorkOrderId = context.active_work_order?.id ?? null;
  const openWorkOrder = useCallback(
    (reference: string) => {
      if (reference === activeWorkOrderId) go('work-order');
      else toastStore.push(messages.workOrders.notLoaded);
    },
    [activeWorkOrderId, go],
  );

  const shellValue = useMemo<ShellContextValue>(
    () => ({ layoutId: layout.layoutId, viewport, worker: context.worker, activeLabel, signOut, runtime, navigate: go, openWorkOrder }),
    [layout.layoutId, viewport, context.worker, activeLabel, signOut, runtime, go, openWorkOrder],
  );

  // Every delivered zone is watched. The Dashboard is the destination that shows the job workspace; other destinations have no zones yet.
  const hasDashboard = context.zones.dashboard !== undefined;
  const hasWorkOrders = context.zones.work_orders !== undefined;
  const watchedKeys = useMemo(
    () => [...ZONE_IDS, ...(hasDashboard ? ['dashboard'] : []), ...(hasWorkOrders ? ['work_orders'] : [])] as string[],
    [hasDashboard, hasWorkOrders],
  );
  // Which zones each screen shows. When the context supplies a dashboard, the Dashboard is that design, and when it supplies work orders, Work Orders
  // is that design. The job workspace (one job's alerts, steps and actions) is the work order hub they open. When a context supplies neither (the
  // practice API today), the job workspace is shown on Dashboard and Work Orders too, so there is always something real to see.
  const onDashboard = activeId === null || activeId === 'dashboard';
  const onJobs = activeId === 'jobs';
  const onHub = activeId === 'work-order';
  const showsDashboard = onDashboard && hasDashboard;
  const showsWorkOrders = onJobs && hasWorkOrders;
  const showsWorkspace = onHub || (onJobs && !hasWorkOrders) || (onDashboard && !hasDashboard);
  // The approved Dashboard and Work Orders designs carry their own headings and show no Context Header.
  const ownsHeading = showsDashboard || showsWorkOrders;
  // The screen context for feedback is captured automatically, as structured data. No screenshot, no values (SDD 15.3).
  const screenContext: ScreenContext = {
    destinationId: activeId,
    layoutId: layout.layoutId,
    viewport,
    zones: watchedKeys.map((zone) => ({ zone, condition: runtime.zones.get(zone).condition })),
  };
  // A lost connection shows until it is restored and never covers content. Reconnecting is a degraded condition (the warning banner); once
  // reconnection has failed it is a failure, so it uses the failure surface with its recovery action (BRD 1.2 5.8; BRD 1.0 section 6).
  const phone = viewport === 'mobile';
  const connectionBanner =
    connection === 'reconnecting' ? (
      <DegradedBanner message={messages.connection.lost} />
    ) : connection === 'failed' ? (
      <InlineError
        title={messages.connection.failed}
        body={messages.connection.failedHelp}
        retryLabel={messages.connection.retry}
        onRetry={() => runtime.retryConnection()}
      />
    ) : null;

  const placements = template.placements[viewport];
  const zonesIn = (region: 'main' | 'aside' | 'collapsible') =>
    placements.filter((p) => p.region === region).flatMap((p) => template.zones.filter((z) => z.id === p.zoneId));
  const mainZones = zonesIn('main');
  const sideZones = zonesIn('aside');
  const collapsibleZones = zonesIn('collapsible');

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

        <Topbar layoutId={layout.layoutId} worker={context.worker} viewport={viewport} onFeedback={() => setFeedbackOpen(true)} />

        {phone && connectionBanner}

        {/* The approved Dashboard design has no Context Header: it is the worker's overview, and its Next job card is the job. */}
        <PageBand title={ownsHeading ? null : onHub ? messages.workOrders.hubTitle : activeLabel}>
          {context.active_work_order && !ownsHeading && <ContextHeader workOrder={context.active_work_order} worker={context.worker} connection={connection} />}
        </PageBand>

        <div className={styles.body}>
          {/* Focus order follows document order: navigation, then primary content, then context (BRD 1.3 section 11.2). */}
          {viewport !== 'mobile' && <div className={styles.navRail}>{navigation}</div>}

          <div className={styles.content}>
          <main id="primary-content" tabIndex={-1} className={styles.main}>
            {!phone && connectionBanner}

            {/* The supplied message stays until the worker dismisses it. */}
            {revocation && <DegradedBanner message={revocation.message} dismissLabel={messages.revoked.dismiss} onDismiss={() => runtime.dismissRevocation()} />}

            {activeId === 'settings' ? (
              <Surface role="card" padding={5}>
                <SettingsScreen />
              </Surface>
            ) : showsDashboard && template.dashboard ? (
              <ZoneHost key="dashboard" spec={template.dashboard} store={runtime.zones} onRetry={retryZone} />
            ) : showsWorkOrders && template.workOrders ? (
              <ZoneHost key="work_orders" spec={template.workOrders} store={runtime.zones} onRetry={retryZone} />
            ) : showsWorkspace ? (
              mainZones.map((zone) => <ZoneHost key={zone.id} spec={zone} store={runtime.zones} onRetry={retryZone} />)
            ) : (
              <Surface role="card" padding={5}>
                <EmptyState title={messages.destination.notBuiltTitle} explanation={messages.destination.notBuiltBody} />
              </Surface>
            )}

            {showsWorkspace && collapsibleZones.length > 0 && (
              <section className={styles.collapsible} aria-label={messages.zone.contextTitle}>
                <Button
                  label={contextOpen ? messages.zone.hideContext : messages.zone.showContext}
                  variant="ghost"
                  fullWidth
                  onActivate={() => setContextOpen((o) => !o)}
                />
                <div id="context-zone" hidden={!contextOpen}>
                  {collapsibleZones.map((zone) => (
                    <ZoneHost key={zone.id} spec={zone} store={runtime.zones} onRetry={retryZone} />
                  ))}
                </div>
              </section>
            )}
          </main>

          {showsWorkspace && sideZones.length > 0 && (
            <aside className={styles.aside} aria-label={messages.zone.contextTitle}>
              {sideZones.map((zone) => (
                <ZoneHost key={zone.id} spec={zone} store={runtime.zones} onRetry={retryZone} />
              ))}
            </aside>
          )}
          </div>
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
