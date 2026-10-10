'use client';

import { useState } from 'react';
import { mockBusControl } from '@/clients/mock/mockBus';
import { mockControls, resetMockControls, type HistoryMode } from '@/clients/mock/mockControls';
import { getIdpPersona } from '@/clients/mock/mockIdp';
import { estimatorDashboard, technicianDashboard, technicianDashboardWithNote } from '@/contracts/fixtures/zones';
import type { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import styles from './DevOverlay.module.css';

// DEVELOPMENT ONLY: shown only in mock mode. Fault injection for every failure the BRDs describe (SDD 12.5), so each
// acceptance criterion can be seen and tested by hand without a backend. Worker-facing text is NOT used here.
const send = (zoneId: string, payload: unknown) => mockBusControl.emit({ type: 'zone.update', zoneId, payload });

export function DevOverlay({ runtime }: { runtime: CanvasRuntime }) {
  const [historyMode, setHistoryMode] = useState<HistoryMode>(mockControls.historyMode);
  const [slowRefresh, setSlowRefresh] = useState(mockControls.refreshDelayMs > 0);
  const [failRefresh, setFailRefresh] = useState(mockControls.refreshFails);

  const dashboardWithNote = () => {
    const persona = getIdpPersona();
    return persona === 'estimator'
      ? { ...estimatorDashboard, notice: { title: 'Quote Q-2291 was updated', body: 'A field review was attached to Northgate Grocers #4830.', tone: 'success' as const } }
      : technicianDashboardWithNote;
  };

  return (
    <details className={styles.overlay}>
      <summary>Dev: mock upstream</summary>
      <div className={styles.body}>
        <p className={styles.group}>Live updates</p>
        <button onClick={() => send('primary:dashboard', { status: 'ready', data: dashboardWithNote() })}>Push update (note)</button>
        <button onClick={() => send('primary:dashboard', { status: 'ready', data: getIdpPersona() === 'estimator' ? estimatorDashboard : technicianDashboard })}>Push update (reset)</button>
        <button onClick={() => send('context', { status: 'nonsense' })}>Push malformed zone payload</button>
        <button onClick={() => send('primary:dashboard', { status: 'unavailable', message: 'The dashboard is temporarily unavailable.' })}>Push unavailable zone</button>
        <button onClick={() => send('primary:dashboard', { status: 'ready', data: { kind: 'brand-new-widget' } })}>Push unknown data shape</button>
        <button onClick={() => mockBusControl.emit({ type: 'zone.update', zoneId: '../../x', payload: {} })}>Push unknown zone id</button>
        <button onClick={() => mockBusControl.emit('not json {')}>Push garbage</button>

        <p className={styles.group}>Connection</p>
        <button onClick={() => mockBusControl.drop()}>Drop connection (recovers)</button>
        <button
          onClick={() => {
            mockBusControl.failConnects = 20;
            mockBusControl.drop();
          }}
        >
          Drop and fail reconnects
        </button>
        <button onClick={() => (mockBusControl.failConnects = 0)}>Allow reconnects</button>

        <p className={styles.group}>Refresh</p>
        <label>
          <input
            type="checkbox"
            checked={slowRefresh}
            onChange={(e) => {
              setSlowRefresh(e.target.checked);
              mockControls.refreshDelayMs = e.target.checked ? 40_000 : 0;
            }}
          />
          Slow refresh (40s, shows the warning)
        </label>
        <label>
          <input
            type="checkbox"
            checked={failRefresh}
            onChange={(e) => {
              setFailRefresh(e.target.checked);
              mockControls.refreshFails = e.target.checked;
            }}
          />
          Refresh fails
        </label>
        <button onClick={() => void runtime.refreshAll()}>Refresh now</button>

        <p className={styles.group}>History</p>
        <select
          aria-label="History behaviour"
          value={historyMode}
          onChange={(e) => {
            setHistoryMode(e.target.value as HistoryMode);
            mockControls.historyMode = e.target.value as HistoryMode;
          }}
        >
          {(['ok', 'slow', 'error', 'empty', 'degraded', 'invalid'] as const).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={() => runtime.history.retry()}>Reload history</button>

        <button
          onClick={() => {
            resetMockControls();
            mockBusControl.reset();
            setHistoryMode('ok');
            setSlowRefresh(false);
            setFailRefresh(false);
          }}
        >
          Reset all
        </button>
      </div>
    </details>
  );
}
