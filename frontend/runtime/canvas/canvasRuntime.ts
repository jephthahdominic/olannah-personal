import type { ContextEnvelope, RuntimeConfig } from '@/contracts';
import type { ContextChannel } from '@/clients/context/contextChannel';
import type { HistoryChannel } from '@/clients/history/historyChannel';
import { BusConnection, type SourceFactory } from '@/clients/bus/busConnection';
import type { SessionIdentity } from '@/clients/session/sessionClient';
import type { DeepReadonly } from '../freeze';
import { HistoryHydrator } from '../history/historyStore';
import { registerPurgeHandler } from '../purgeSession';
import { logEvent } from '../telemetry';
import { RefreshManager } from '../updates/refreshManager';
import { UpdatePipeline } from '../updates/updatePipeline';
import { CONTEXT_ZONE, primaryZoneKey } from '../zones/zoneKeys';
import { ZoneStore } from '../zones/zoneStore';

// The canvas runtime owns everything that happens AFTER the first render: the bus connection, the update pipeline, the
// refresh timers and history hydration (SDD 3.4 "canvas-runtime"). It is framework-free and fully testable. The render
// path only reads its state, never its clients (SDD 3.3).

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface CanvasRuntimeDeps {
  context: DeepReadonly<ContextEnvelope>;
  session: SessionIdentity;
  config: RuntimeConfig;
  upstream: { context: ContextChannel; history: HistoryChannel; createBusSource: SourceFactory };
  /** Wraps store writes so React treats them as low priority (a transition). */
  applyBatch?: (apply: () => void) => void;
  /** True while a checkpoint is active. Updates queue and timers pause. */
  isBlocked?: () => boolean;
  /** Injectable for tests. */
  schedule?: (flush: () => void) => void;
  random?: () => number;
}

export class CanvasRuntime {
  readonly zones = new ZoneStore();
  readonly history: HistoryHydrator;

  #status: ConnectionStatus = 'connecting';
  #statusListeners = new Set<() => void>();
  #lost = false; // true once a connection that had been established was lost
  #pipeline: UpdatePipeline | null = null;
  #refresh: RefreshManager | null = null;
  #bus: BusConnection | null = null;
  #unregisterPurge: (() => void) | null = null;

  constructor(private readonly deps: CanvasRuntimeDeps) {
    // Zones are initialised synchronously from the context object, so the first render already has its data.
    this.zones.initialize([primaryZoneKey('dashboard'), CONTEXT_ZONE], deps.context.zones);
    this.history = new HistoryHydrator(deps.upstream.history);
  }

  subscribeConnection = (listener: () => void): (() => void) => {
    this.#statusListeners.add(listener);
    return () => this.#statusListeners.delete(listener);
  };
  getConnection = (): ConnectionStatus => this.#status;

  /** Whether actions that write to a source system are available. Always false without a live connection (BRD 1.0 UR11D). */
  get canWrite(): boolean {
    return this.#status === 'connected';
  }

  start(): void {
    const { config, upstream, session } = this.deps;
    const pipeline = new UpdatePipeline({
      store: this.zones,
      stalenessWarnMs: config.refresh.stalenessWarnMs,
      isBlocked: this.deps.isBlocked,
      applyBatch: this.deps.applyBatch,
      schedule: this.deps.schedule,
    });
    this.#pipeline = pipeline;

    this.#refresh = new RefreshManager({
      store: this.zones,
      pipeline,
      requestContext: () => upstream.context.request(session),
      autoIntervalMs: config.refresh.autoIntervalMs,
      isBlocked: this.deps.isBlocked,
    });
    this.#refresh.start();

    this.#bus = new BusConnection(
      upstream.createBusSource,
      { ...config.bus, random: this.deps.random },
      { onEvent: (data) => pipeline.receive(data), onState: (state) => this.#onBusState(state) },
    );
    this.#bus.start();

    // The second pass: history is requested only after the main workspace has rendered.
    this.history.start(this.deps.context.historyRef);

    this.#unregisterPurge?.();
    this.#unregisterPurge = registerPurgeHandler(() => this.dispose());
  }

  /** Manual retry from the "reconnection failed" banner. */
  retryConnection(): void {
    this.#bus?.retry();
  }

  /** Refresh every zone now. Also used by a zone's own "try again". */
  refreshAll(): Promise<void> {
    return this.#refresh?.refreshAll() ?? Promise.resolve();
  }

  /** The checkpoint ended: apply anything that was queued, and run any refresh that was held back. */
  resume(): void {
    this.#pipeline?.drainQueue();
    this.#refresh?.resume();
  }

  /** Stops all work. Safe to call twice, and safe to start() again afterwards (React StrictMode remounts). */
  dispose(): void {
    this.#bus?.close();
    this.#bus = null;
    this.#refresh?.dispose();
    this.#refresh = null;
    this.#pipeline?.dispose();
    this.#pipeline = null;
    this.history.dispose();
    this.#unregisterPurge?.();
    this.#unregisterPurge = null;
  }

  #onBusState(state: ConnectionStatus): void {
    const previous = this.#status;
    this.#setStatus(state);

    if (state === 'reconnecting' && previous === 'connected') {
      // The connection was lost. Keep the last known data on screen, marked stale, and say so (BRD 1.0 error row 8).
      this.#lost = true;
      this.zones.markAllStale();
      logEvent('bus.disconnected', 'warn');
    } else if (state === 'connected' && this.#lost) {
      // Events may have been missed while we were away, so refresh every zone rather than trust resume (SDD 12.4).
      this.#lost = false;
      logEvent('bus.reconnected', 'info');
      void this.refreshAll();
    } else if (state === 'failed') {
      logEvent('bus.reconnect_failed', 'error');
    }
  }

  #setStatus(next: ConnectionStatus): void {
    if (this.#status === next) return;
    this.#status = next;
    for (const l of [...this.#statusListeners]) l();
  }
}
