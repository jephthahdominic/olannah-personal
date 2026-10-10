'use client';

import { useState } from 'react';
import { mockAssistantControl } from '@/clients/mock/mockAssistant';
import { mockBusControl } from '@/clients/mock/mockBus';
import { mockControls, resetMockControls, type HistoryMode } from '@/clients/mock/mockControls';
import { getIdpPersona } from '@/clients/mock/mockIdp';
import { estimatorDashboard, technicianDashboard, technicianDashboardWithNote } from '@/contracts/fixtures/zones';
import type { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import styles from './DevOverlay.module.css';

// DEVELOPMENT ONLY: shown only in mock mode. Fault injection for every failure the BRDs describe (SDD 12.5), so each
// acceptance criterion can be seen and tested by hand without a backend. Worker-facing text is NOT used here.
const send = (zoneId: string, payload: unknown) => mockBusControl.emit({ type: 'zone.update', zoneId, payload });
const pushWidget = (widget: unknown) => {
  const base = getIdpPersona() === 'estimator' ? estimatorDashboard : technicianDashboard;
  send('primary:dashboard', { status: 'ready', data: { ...base, widgets: [widget] } });
};

export function DevOverlay({ runtime }: { runtime: CanvasRuntime }) {
  const [historyMode, setHistoryMode] = useState<HistoryMode>(mockControls.historyMode);
  const [slowRefresh, setSlowRefresh] = useState(mockControls.refreshDelayMs > 0);
  const [failRefresh, setFailRefresh] = useState(mockControls.refreshFails);
  const [feedbackFails, setFeedbackFails] = useState(mockControls.feedbackFails);

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

        <p className={styles.group}>Insight widgets</p>
        <button onClick={() => pushWidget({ type: 'insight', schemaVersion: '1.0', payload: { title: 'Check the door gasket', body: 'Two earlier visits replaced the gasket within 90 days.', label: 'Evidence-backed' } })}>Push valid insight</button>
        <button onClick={() => pushWidget({ type: 'insight', schemaVersion: '9.9', payload: { title: 'x', body: 'y' } })}>Push newer version (unsupported)</button>
        <button onClick={() => pushWidget({ type: 'hologram', schemaVersion: '1.0', payload: {} })}>Push unknown type</button>
        <button onClick={() => pushWidget({ type: 'insight', schemaVersion: '1.0', payload: { title: 42 } })}>Push invalid payload</button>
        <button onClick={() => pushWidget({ type: 'insight', schemaVersion: '1.0', condition: 'degraded', degradedMessage: 'Built from partial service history.', payload: { title: 'Likely intermittent defrost fault', body: 'The pattern matches repeated door-open events.' } })}>Push supplied-degraded insight</button>

        <p className={styles.group}>Assistant</p>
        <button onClick={() => mockAssistantControl.speak('A new note from the store manager changes your arrival instructions.')}>Assistant speaks first (proactive)</button>
        <button onClick={() => mockAssistantControl.drop()}>Drop assistant connection</button>
        <button onClick={() => (mockAssistantControl.failConnects = 20)}>Fail assistant reconnects</button>

        <p className={styles.group}>Feedback</p>
        <label>
          <input type="checkbox" checked={feedbackFails} onChange={(e) => { setFeedbackFails(e.target.checked); mockControls.feedbackFails = e.target.checked; }} />
          Feedback submission fails
        </label>

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
            mockAssistantControl.reset();
            setFeedbackFails(false);
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
