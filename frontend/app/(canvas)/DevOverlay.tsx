'use client';

import { useState } from 'react';
import { mockAssistantControl } from '@/clients/mock/mockAssistant';
import { mockBusControl } from '@/clients/mock/mockBus';
import { mockCheckpointControl, type MockDiffMode, type MockSubmitMode } from '@/clients/mock/mockCheckpointChannel';
import { malformedTrigger, unknownVersionTrigger } from '@/contracts/fixtures/checkpoint';
import { mockControls, resetMockControls, type HistoryMode } from '@/clients/mock/mockControls';
import { getUpstream, upstreamMode } from '@/clients/upstream';
import { dashboardZone } from '@/contracts/fixtures/dashboard';
import { workOrdersZone } from '@/contracts/fixtures/workOrders';
import type { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import styles from './DevOverlay.module.css';

// DEVELOPMENT ONLY: shown in mock and practice modes. Fault injection for every failure the BRDs describe (SDD 12.5), so each
// acceptance criterion can be seen and tested by hand. Worker-facing text is NOT used here.
//
// Live updates go through the mock bus, with zone payloads in the DELIVERED shape (state, as_of, data), because the practice API has no
// bus yet. In practice mode the server's own fault switches are also here.
const NOW = '2026-10-23T08:05:00-05:00';
const send = (zoneId: string, payload: unknown) => mockBusControl.emit({ type: 'zone.update', zoneId, payload });
const NEW_ALERT = { id: 'a-live', severity: 'critical', message: 'The store manager added access instructions: use the south receiving entrance.', suggestion: 'Call on arrival.', evidence: [{ system: 'xoi', ref: 'note 1' }] };

const SOURCE_FAULTS = [
  ['One system down (sitedocs)', { sitedocs: 'down' }],
  ['Two systems down (sitedocs, xoi)', { sitedocs: 'down', xoi: 'down' }],
  ['Portal login wall', { client_portal: 'login_wall' }],
  ['System of record down (sampro)', { sampro: 'down' }],
] as const;
const DELIVERY_FAULTS = [
  ['Slow delivery (2 s, flagged)', { delay_seconds: 2 }],
  ['Too slow (12 s, 504 recovery screen)', { delay_seconds: 12 }],
  ['Unknown schema version', { payload: 'bad_schema' }],
  ['One broken zone', { payload: 'malformed_zone' }],
  ['Whole payload broken', { payload: 'malformed_envelope' }],
] as const;
const SCENARIOS = ['s_8f2', 's_clear', 's_busy', 's_nojob', 's_unmapped'] as const;

export function DevOverlay({ runtime }: { runtime: CanvasRuntime }) {
  const [historyMode, setHistoryMode] = useState<HistoryMode>(mockControls.historyMode);
  const [slowRefresh, setSlowRefresh] = useState(mockControls.refreshDelayMs > 0);
  const [failRefresh, setFailRefresh] = useState(mockControls.refreshFails);
  const [feedbackFails, setFeedbackFails] = useState(mockControls.feedbackFails);
  const [practiceNote, setPracticeNote] = useState('');
  const upstream = getUpstream();
  const faults = upstream.devFaults;
  const practice = upstream.practice;
  const run = (job: Promise<void> | undefined) => job?.then(() => setPracticeNote('Applied. Use Refresh now, or reload the page, to see it.'), (e: unknown) => setPracticeNote(String((e as Error).message)));

  return (
    <details className={styles.overlay}>
      <summary title={upstreamMode === 'practice' ? 'Dev tools: practice API' : 'Dev tools: mock upstream'}>Dev</summary>
      <div className={styles.body}>
        {upstreamMode === 'practice' && faults && practice && (
          <>
            <p className={styles.group}>Practice API</p>
            <label>
              Scenario (applies on reload)
              <select aria-label="Practice scenario" defaultValue={practice.getSession()} onChange={(e) => practice.setSession(e.target.value as (typeof SCENARIOS)[number])}>
                {SCENARIOS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            {SOURCE_FAULTS.map(([label, body]) => <button key={label} onClick={() => run(faults.setSourceFaults(body))}>{label}</button>)}
            <button onClick={() => run(faults.resetSourceFaults())}>Reset system faults</button>
            {DELIVERY_FAULTS.map(([label, body]) => <button key={label} onClick={() => run(faults.setDeliveryFault(body))}>{label}</button>)}
            <button onClick={() => run(faults.resetDeliveryFault())}>Reset delivery</button>
            {practiceNote && <p role="status">{practiceNote}</p>}
          </>
        )}

        <p className={styles.group}>Dashboard</p>
        <button onClick={() => send('dashboard', dashboardZone('client-update'))}>Push a client note onto the next job</button>
        <button onClick={() => send('dashboard', dashboardZone('insight'))}>Push an insight onto the next job</button>
        <button onClick={() => send('dashboard', dashboardZone('no-jobs'))}>Push the no-jobs dashboard</button>
        <button onClick={() => send('dashboard', dashboardZone('ready'))}>Push the ready dashboard</button>
        <button onClick={() => mockBusControl.emit({ type: 'access.revoked', message: 'You no longer have access to the previous screen.' })}>Revoke access to this screen</button>

        <p className={styles.group}>Work orders</p>
        <button onClick={() => send('work_orders', workOrdersZone('assigned'))}>Push the assigned jobs</button>
        <button onClick={() => send('work_orders', workOrdersZone('empty'))}>Push the empty list</button>
        <label>
          <input type="checkbox" defaultChecked={mockControls.moreFails} onChange={(e) => (mockControls.moreFails = e.target.checked)} />
          Show more jobs fails
        </label>

        <p className={styles.group}>Live updates</p>
        <button onClick={() => send('alerts', { state: 'rendered', as_of: NOW, data: [NEW_ALERT] })}>Push update (new alert)</button>
        <button onClick={() => send('alerts', { state: 'rendered', as_of: NOW, data: [] })}>Push update (alerts cleared)</button>
        <button onClick={() => send('steps', { state: 'unavailable', as_of: null, data: [] })}>Push unavailable zone (steps)</button>
        <button onClick={() => send('alerts', { state: 'stale', as_of: NOW, data: [] })}>Push zone with state stale (malformed)</button>
        <button onClick={() => send('actions', { state: 'rendered', as_of: NOW, data: 'nope' })}>Push malformed zone payload</button>
        <button onClick={() => mockBusControl.emit({ type: 'zone.update', zoneId: '../../x', payload: {} })}>Push unknown zone id</button>
        <button onClick={() => mockBusControl.emit('not json {')}>Push garbage</button>

        <p className={styles.group}>Assistant</p>
        <button onClick={() => mockAssistantControl.speak('A new note from the store manager changes your arrival instructions.')}>Assistant speaks first (proactive)</button>
        <button onClick={() => mockAssistantControl.drop()}>Drop assistant connection</button>
        <button onClick={() => (mockAssistantControl.failConnects = 20)}>Fail assistant reconnects</button>

        <p className={styles.group}>Feedback</p>
        <label>
          <input type="checkbox" checked={feedbackFails} onChange={(e) => { setFeedbackFails(e.target.checked); mockControls.feedbackFails = e.target.checked; }} />
          Feedback submission fails
        </label>

        <p className={styles.group}>Checkpoint</p>
        <button onClick={() => mockCheckpointControl.raise()}>Raise a checkpoint</button>
        <button onClick={() => { mockCheckpointControl.raise(); mockCheckpointControl.raise(); }}>Raise two (second is rejected)</button>
        <button onClick={() => mockCheckpointControl.raiseRaw(malformedTrigger)}>Raise malformed trigger (nothing shows)</button>
        <button onClick={() => mockCheckpointControl.raiseRaw(unknownVersionTrigger)}>Raise unknown-version trigger</button>
        <button onClick={() => { const id = mockCheckpointControl.raise(); window.setTimeout(() => mockCheckpointControl.upstreamChange(id), 3000); }}>Raise, upstream changes in 3s</button>
        <button onClick={() => { mockCheckpointControl.raise(); window.setTimeout(() => mockBusControl.drop(), 2500); }}>Raise, connection drops in 2.5s (recovers)</button>
        <button onClick={() => { mockCheckpointControl.validateValid = false; mockCheckpointControl.raise(); window.setTimeout(() => mockBusControl.drop(), 2500); }}>Raise, drop, then revalidation fails</button>
        <label>
          Diff behaviour
          <select aria-label="Checkpoint diff behaviour" defaultValue={mockCheckpointControl.diffMode} onChange={(e) => (mockCheckpointControl.diffMode = e.target.value as MockDiffMode)}>
            {(['ok', 'slow', 'never', 'malformed', 'error'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          Decision submission
          <select aria-label="Checkpoint submission behaviour" defaultValue={mockCheckpointControl.submitMode} onChange={(e) => (mockCheckpointControl.submitMode = e.target.value as MockSubmitMode)}>
            {(['ok', 'fail', 'mismatch', 'mutation'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
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
            mockCheckpointControl.reset();
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
