'use client';

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Surface, SectionHeader, Label, Icon, Button, Link, KeyValue, DetailRow, StatTile, Avatar, RecordList, HistoryList, WorkflowStepper,
  TextInput, TextArea, PasswordInput, FormField, LookupField, PhotoCapture, ChoiceGroup, NumberInput, StatusPill, StatusIndicator,
  SyncDot, Skeleton, Toast, InlineError, DegradedBanner, EmptyState, NavItem, NavigationRail, TabBar, MoreMenu, AssistantPanel,
  FeedbackForm, WidgetContainer, Select, DatePicker, HealthBadge, type AssistantTurnView, type NavItemModel, type CapturedPhoto, type SkeletonShape,
} from '@/components';
import {
  AccountabilityStatement, AcknowledgmentControl, CheckpointInitializing, ConfirmationGesture, DecisionControls, DiffView,
} from '@/components/checkpoint';
import { BarChart, DonutChart, LineChart, ProgressRing, SLAIndicator } from '@/components/visualization';
import { CheckpointController } from '@/runtime/checkpoint/checkpointController';
import type { CheckpointChannel } from '@/clients/checkpoint/checkpointChannel';
import { CheckpointView } from '@/render/checkpoint/CheckpointView';
import { messages } from '@/render/messages';
import { validDiff, validTrigger } from '@/contracts/fixtures/checkpoint';
import { technicianDashboard } from '@/contracts/fixtures/zones';
import styles from './demos.module.css';

// One live, interactive example per built component. Every value here is SAMPLE data: components render what they are given
// (BRD 1.2 5.2), so the gallery supplies it the way the canvas would. Nothing here is fetched.

export type Stage = 'card' | 'workspace' | 'panel' | 'chrome' | 'frame';
export interface Demo {
  node: ReactNode;
  /** Spans the full row. */
  wide?: boolean;
  /** The surface the demo sits on. Defaults to a white card. */
  stage?: Stage;
}

const navItems: NavItemModel[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', active: true },
  { id: 'work-orders', label: 'Work Orders', icon: 'clipboard-list' },
  { id: 'assets', label: 'Assets', icon: 'box', unavailable: true, unavailableReason: 'Assets are unavailable while offline.' },
  { id: 'settings', label: 'Settings', icon: 'settings', pinned: true },
];
const tabItems: NavItemModel[] = [...navItems.filter((i) => !i.pinned), { id: 'more', label: 'More', icon: 'dots' }];

function Stack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}
function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

function ButtonDemo() {
  const [busy, setBusy] = useState(false);
  return (
    <Row>
      <Button label="Open work order" />
      <Button label="Review changes" variant="accent" />
      <Button label="Back to job" variant="ghost" />
      <Button label={busy ? 'Saving note' : 'Save note'} processing={busy} processingLabel="Saving note" onActivate={() => { setBusy(true); window.setTimeout(() => setBusy(false), 1500); }} />
      <Button label="Sync unavailable" disabled />
    </Row>
  );
}

function TextDemo() {
  const [v, setV] = useState('Walk-in freezer');
  return (
    <FormField id="demo-text" label="Equipment" helpText="Shown to the technician on arrival.">
      <TextInput id="demo-text" value={v} onChange={setV} describedBy="demo-text-message" />
    </FormField>
  );
}
function TextAreaDemo() {
  const [v, setV] = useState('');
  return (
    <FormField id="demo-notes" label="Notes">
      <TextArea id="demo-notes" value={v} onChange={setV} rows={3} />
    </FormField>
  );
}
function PasswordDemo() {
  const [v, setV] = useState('');
  return (
    <FormField id="demo-password" label="Password">
      <PasswordInput id="demo-password" value={v} onChange={setV} autoComplete="current-password" showLabel="Show password" hideLabel="Hide password" />
    </FormField>
  );
}
function FormFieldDemo() {
  const [v, setV] = useState('');
  return (
    <FormField id="demo-ff" label="Site contact" validationMessage={v.length === 0 ? 'Enter a contact name before you continue.' : undefined} helpText="Who is on site.">
      <TextInput id="demo-ff" value={v} onChange={setV} invalid={v.length === 0} describedBy="demo-ff-message" />
    </FormField>
  );
}

const SAMPLE_WORK_ORDERS = [
  { id: 'wo1', timeLocal: '10:30', title: 'Northgate Grocers #4830', subtitle: 'Walk-in freezer not recovering', status: { label: 'Priority', tone: 'warning' as const } },
  { id: 'wo2', timeLocal: '13:15', title: 'Union Coffee Roasters', subtitle: 'Preventive maintenance', status: { label: 'Approved', tone: 'success' as const } },
];
function RecordListDemo() {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Stack>
      <RecordList records={SAMPLE_WORK_ORDERS} ariaLabel="Later today" emptyTitle="Nothing queued" emptyExplanation="Jobs appear here as they are assigned." onSelect={setPicked} />
      <p className="type-caption">{picked ? `row-select: ${picked}` : 'Select a row to see the event it emits.'}</p>
    </Stack>
  );
}
function HistoryDemo() {
  const [mode, setMode] = useState<'ready' | 'loading' | 'empty' | 'degraded' | 'error'>('ready');
  return (
    <Stack>
      <Row>
        {(['ready', 'loading', 'empty', 'degraded', 'error'] as const).map((m) => (
          <Button key={m} label={m} variant={mode === m ? 'primary' : 'ghost'} onActivate={() => setMode(m)} />
        ))}
      </Row>
      <HistoryList
        status={mode}
        records={mode === 'ready' || mode === 'degraded' ? [{ id: 'h1', occurredOn: '2026-09-21', title: 'Recovery exceeded 45 minutes', summary: 'Door left ajar during delivery.' }, { id: 'h2', occurredOn: '2026-09-04', title: 'Evaporator ice cleared' }] : []}
        loadingMore={false}
        hasMore={false}
        ariaLabel="Service history"
        degradedMessage="Some older visits are not available yet."
        emptyTitle="No history yet"
        emptyExplanation="Visits appear here after the first completed job."
        errorTitle="History could not be loaded"
        errorExplanation="Try again in a moment."
        retryLabel="Retry history"
        loadMoreLabel="Load more history"
        loadingLabel="Loading history"
        onRetry={() => setMode('ready')}
        onRequestMore={() => {}}
      />
    </Stack>
  );
}
function StepperDemo() {
  const [active, setActive] = useState('diagnose');
  const steps = [
    { id: 'arrive', label: 'Arrive on site', completion: 'complete' as const, statusLabel: 'Done', detail: 'Arrived at 8:02 AM.' },
    { id: 'diagnose', label: 'Diagnose', completion: 'incomplete' as const, statusLabel: 'In progress', detail: 'Check the defrost sensor and the door gasket.', advanceLabel: 'Record diagnosis' },
    { id: 'repair', label: 'Repair and verify', completion: 'incomplete' as const, statusLabel: 'Not started', detail: 'Replace the part and confirm recovery.', advanceLabel: 'Complete repair' },
  ].map((s) => (s.id === 'diagnose' && active === 'repair' ? { ...s, completion: 'complete' as const, statusLabel: 'Done' } : s));
  return <WorkflowStepper steps={steps} activeStepId={active} ariaLabel="Job steps" onAdvance={() => setActive('repair')} />;
}
function LookupDemo() {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const all = [{ id: 'a', label: 'WO-48213', detail: 'Northgate Grocers #4830' }, { id: 'b', label: 'WO-48214', detail: 'Union Coffee Roasters' }, { id: 'c', label: 'WO-48220', detail: 'Beacon Hotel' }];
  const results = all.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <Stack>
      <FormField id="demo-lookup" label="Work order">
        <LookupField id="demo-lookup" query={query} onQueryChange={setQuery} data={query === '' ? 'idle' : results.length ? 'ready' : 'empty'} results={results} emptyMessage="No work order matches that number." loadingMessage="Searching work orders" onSelect={(id) => { setPicked(id); setQuery(all.find((r) => r.id === id)?.label ?? ''); }} />
      </FormField>
      <p className="type-caption">{picked ? `result-select: ${picked}` : 'Type "WO" to search sample work orders.'}</p>
    </Stack>
  );
}
function PhotoDemo() {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  return (
    <PhotoCapture
      prompt="Photograph the data plate"
      captureLabel="Take photo"
      requiredLabel="Required"
      required
      captured={photos}
      emptyMessage="No photo yet."
      onCaptureComplete={(files) => setPhotos((p) => [...p, ...files.map((f, i) => ({ id: `${Date.now()}-${i}`, previewUrl: URL.createObjectURL(f), label: `Photo ${p.length + i + 1}` }))])}
    />
  );
}
function ChoiceDemo() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <ChoiceGroup legend="Time type" name="demo-time" selection={sel} onChange={setSel} options={[{ value: 'travel', label: 'Travel' }, { value: 'onsite', label: 'On site', description: 'Time at the customer location' }, { value: 'parts', label: 'Parts run' }]} emptyTitle="No options" emptyExplanation="Options appear when the job supplies them." />
  );
}
function NumberDemo() {
  const [qty, setQty] = useState<number | null>(2);
  return (
    <FormField id="demo-qty" label="Quantity" helpText="Between 1 and 10.">
      <NumberInput id="demo-qty" value={qty} onChange={setQty} minimum={1} maximum={10} steppers={{ decrementLabel: 'Decrease quantity', incrementLabel: 'Increase quantity' }} describedBy="demo-qty-message" />
    </FormField>
  );
}
function ToastDemo() {
  const [shown, setShown] = useState(true);
  return shown ? <Toast message="Note saved to the work order." tone="success" dismissLabel="Dismiss message" onDismiss={() => setShown(false)} /> : <Button label="Show the toast again" variant="ghost" onActivate={() => setShown(true)} />;
}
function InlineErrorDemo() {
  return (
    <Stack>
      <InlineError title="The work order could not be saved" body="Your note is still here. Try saving again." retryLabel="Retry saving" onRetry={() => {}} />
      <InlineError tone="degraded" title="Parts availability may be out of date" body="You can keep working. It updates when the connection returns." />
    </Stack>
  );
}
function MoreMenuDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Open the More menu" variant="ghost" onActivate={() => setOpen(true)} />
      <MoreMenu
        open={open}
        actions={[{ id: 'ask', icon: 'sparkles', title: 'Ask Olannah', description: 'Get help with this job' }, { id: 'feedback', icon: 'message', title: 'Feedback', description: 'Tell us about this screen' }, { id: 'settings', icon: 'settings', title: 'Settings', description: 'Account and preferences' }]}
        onCloseRequest={() => setOpen(false)}
        onActionSelect={() => setOpen(false)}
        onDestinationSelect={() => setOpen(false)}
      />
    </>
  );
}
function AssistantDemo() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<AssistantTurnView[]>([{ id: 't1', role: 'assistant', text: 'Three recent visits mention ice buildup. Bring a defrost control kit.', proactive: true }]);
  return (
    <>
      <Button label="Open the assistant" variant="ghost" onActivate={() => setOpen(true)} />
      <AssistantPanel
        open={open} presentation="floating" showTrigger={false} turns={turns} data="ready" connection="connected" unread={0}
        draft={draft} onDraftChange={setDraft}
        onSubmit={(text) => { setTurns((t) => [...t, { id: `u${t.length}`, role: 'user', text }]); setDraft(''); }}
        onOpen={() => setOpen(true)} onClose={() => setOpen(false)} onRetryConnection={() => {}}
        labels={{ title: 'Ask Olannah', trigger: 'Ask Olannah', unreadTrigger: (n) => `Ask Olannah, ${n} new`, close: 'Close assistant', inputLabel: 'Your question', send: 'Send question', userName: 'You', assistantName: 'Olannah', proactive: 'Suggested', emptyTitle: 'Nothing asked yet', emptyBody: 'Questions you ask appear here.', loading: 'Loading conversation', reconnecting: 'Reconnecting to the assistant', disconnected: 'The assistant is not connected', retry: 'Retry connection' }}
      />
    </>
  );
}
function FeedbackDemo() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'succeeded' | 'failed'>('idle');
  return (
    <>
      <Button label="Open feedback" variant="ghost" onActivate={() => { setStatus('idle'); setOpen(true); }} />
      <FeedbackForm
        open={open} presentation="popover" screenSummary="Component library, Feedback and status" draft={draft} onDraftChange={setDraft} status={status} maxLength={500}
        onSubmit={() => { setStatus('submitting'); window.setTimeout(() => setStatus('succeeded'), 800); }}
        onDismiss={() => { setOpen(false); setDraft(''); }}
        labels={{ title: 'Send feedback', aboutLabel: 'About', fieldLabel: 'What would you like to tell us?', submit: 'Send feedback', submitting: 'Sending feedback', close: 'Close feedback', doneTitle: 'Feedback sent', doneBody: 'Thank you. The screen you were on was included.', doneClose: 'Close', failedTitle: 'Feedback was not sent', failedBody: 'Your words are still here. Try again.', retry: 'Retry sending' }}
      />
    </>
  );
}
function WidgetDemo() {
  const [kind, setKind] = useState<'insight' | 'unsupported'>('insight');
  const widget = kind === 'insight' ? technicianDashboard.widgets?.[0] : { type: 'forecast', schemaVersion: '9.0', payload: {} };
  return (
    <Stack>
      <Row>
        <Button label="Supported insight" variant={kind === 'insight' ? 'primary' : 'ghost'} onActivate={() => setKind('insight')} />
        <Button label="Unsupported insight" variant={kind === 'unsupported' ? 'primary' : 'ghost'} onActivate={() => setKind('unsupported')} />
      </Row>
      <WidgetContainer widget={widget} headerLabel="Olannah Insight" fallbackTitle="This insight cannot be shown" fallbackMessage="The rest of your work is not affected." />
    </Stack>
  );
}

// A REAL checkpoint controller on an in-memory channel, shown inside a frame that contains the fixed-position overlay (a transformed
// ancestor becomes the containing block), so the live surface can be tried without blocking the gallery.
function CheckpointDemo() {
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const controller = useMemo(() => {
    const id = `demo-${run}`;
    const channel: CheckpointChannel = {
      subscribe: () => () => {},
      fetchDiff: async () => { await new Promise((r) => setTimeout(r, 600)); return { ...validDiff, checkpointId: id }; },
      submitDecision: async () => { await new Promise((r) => setTimeout(r, 400)); return { status: 'acknowledged' }; },
      submitAudit: async () => {},
      validate: async () => ({ checkpointId: id, valid: true }),
    };
    return new CheckpointController({ channel, session: { sessionId: 'gallery', workerId: 'gallery' }, texts: { accountability: messages.checkpoint.accountability } });
  }, [run]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const start = () => { setStarted(true); controller.receiveTrigger({ ...validTrigger, checkpointId: `demo-${run}` }); };
  const again = () => { setStarted(false); setRun((n) => n + 1); };
  const over = state.phase === 'terminal';
  return (
    <Stack>
      <Row>
        {!started && <Button label="Show a sample checkpoint" onActivate={start} />}
        {started && <Button label="Start again" variant="ghost" onActivate={again} />}
      </Row>
      {started && (
        <div className={styles.contain}>
          {over && state.outcome ? (
            <p className={`${styles.outcome} type-body`}>{messages.checkpoint.outcome[state.outcome].text}</p>
          ) : (
            <CheckpointView state={state} confirmWindowMs={controller.timings.confirmWindowMs} onAcknowledge={() => controller.acknowledge()} onApprove={() => controller.approve()} onReject={() => controller.reject()} />
          )}
        </div>
      )}
    </Stack>
  );
}
function AcknowledgmentDemo() {
  const [ack, setAck] = useState(false);
  return (
    <Stack>
      <AcknowledgmentControl statement={messages.checkpoint.acknowledgment} checkpointId="demo" acknowledged={ack} onAcknowledge={() => setAck(true)} />
      <Button label="Reset acknowledgment" variant="ghost" onActivate={() => setAck(false)} />
    </Stack>
  );
}
function GestureDemo() {
  const [done, setDone] = useState(0);
  const t = messages.checkpoint;
  return (
    <Stack>
      <ConfirmationGesture label={t.approve} armedLabel={t.approveArmed} armedAnnouncement={t.approveArmedAnnouncement} disarmedAnnouncement={t.approveDisarmed} processingLabel={t.submitting} windowMs={5000} enabled onComplete={() => setDone((n) => n + 1)} />
      <p className="type-caption">gesture-complete emitted {done} {done === 1 ? 'time' : 'times'}. One tap only arms it.</p>
    </Stack>
  );
}
function DecisionDemo() {
  const [enabled, setEnabled] = useState(false);
  const [last, setLast] = useState('No decision yet.');
  const t = messages.checkpoint;
  return (
    <Stack>
      <Button label={enabled ? 'Make approval unavailable' : 'Make approval available'} variant="ghost" onActivate={() => setEnabled((e) => !e)} />
      <DecisionControls rejectLabel={t.reject} approveLabel={t.approve} approveArmedLabel={t.approveArmed} approveArmedAnnouncement={t.approveArmedAnnouncement} approveDisarmedAnnouncement={t.approveDisarmed} processingLabel={t.submitting} approveEnabled={enabled} deciding={null} confirmWindowMs={5000} onApproveIntent={() => setLast('approve-intent emitted')} onReject={() => setLast('reject emitted')} />
      <p className="type-caption">{last}</p>
    </Stack>
  );
}

function SelectDemo() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <FormField id="demo-condition" label="Failure condition" helpText="Options come from the work order.">
      <Select id="demo-condition" selection={sel} onChange={setSel} placeholder="Choose a failure condition" emptyLabel="No conditions supplied" options={[{ value: 'sensor', label: 'Intermittent open sensor' }, { value: 'fan', label: 'Failed fan motor' }, { value: 'ice', label: 'Evaporator ice buildup' }]} />
    </FormField>
  );
}
function DateDemo() {
  const [date, setDate] = useState<string | null>('2026-10-17');
  return (
    <FormField id="demo-valid" label="Valid through" helpText="Between Oct 10 and Oct 31, 2026.">
      <DatePicker id="demo-valid" meaning="valid-through" value={date} onChange={setDate} min="2026-10-10" max="2026-10-31" />
    </FormField>
  );
}
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const QUOTES = [
  { id: 'drafted', name: 'Drafted', values: [3, 4, 2, 5, 4] },
  { id: 'approved', name: 'Approved', values: [2, 1, 3, 2, null] },
];
const CHART_TEXT = { emptyTitle: 'No data yet', emptyExplanation: 'Figures appear here once quotes have been drafted this week.' };
function ChartsDemo() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Stack>
      <BarChart title="Quotes this week" legendLabel="Quote status" categories={WEEK} series={QUOTES} textAlternative="Quotes drafted peaked at 5 on Thursday. Approvals peaked at 3 on Wednesday. Friday approvals are not in yet." selectedSeriesId={sel} onSeriesSelect={(id) => setSel((cur) => (cur === id ? null : id))} {...CHART_TEXT} />
      <BarChart title="Open value by customer" legendLabel="Quote status" orientation="horizontal" categories={['Northgate', 'Union Coffee', 'Bayview']} series={[{ id: 'open', name: 'Open value ($)', values: [18200, 9400, 15260] }]} textAlternative="Northgate Grocers has the most open value at $18,200." {...CHART_TEXT} />
    </Stack>
  );
}
function LineDemo() {
  return (
    <LineChart title="Box temperature recovery" legendLabel="Series" xKind="site-local-date" xLabels={['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']} series={[{ id: 'box', name: 'Box temp (°F)', values: [19, 12, 4, null, -1] }, { id: 'set', name: 'Setpoint (°F)', values: [-2, -2, -2, -2, -2] }]} textAlternative="The box recovered from 19°F to -1°F over the period. The Sep 24 reading is missing." onPointSelect={() => {}} {...CHART_TEXT} />
  );
}
function DonutDemo() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <DonutChart title="Packet composition" legendLabel="Segments" centerValue="42" centerCaption="packets" textAlternative="42 packets: 20 complete, 14 in review, 8 blocked." segments={[{ id: 'complete', label: 'Complete', value: 20 }, { id: 'review', label: 'In review', value: 14 }, { id: 'blocked', label: 'Blocked', value: 8 }]} selectedSegmentId={sel} onSegmentSelect={(id) => setSel((cur) => (cur === id ? null : id))} {...CHART_TEXT} />
  );
}
function RingDemo() {
  return (
    <Row>
      <ProgressRing value={7} total={10} centeredLabel="70%" textAlternative="Quote completeness: 7 of 10 items complete." size={48} emptyExplanation="No items to count yet." />
      <ProgressRing value={3} total={4} centeredLabel="3/4" textAlternative="3 of 4 evidence items attached." size={32} emptyExplanation="No items to count yet." />
      <ProgressRing value={0} total={0} centeredLabel="" textAlternative="" emptyExplanation="No items to count yet." />
    </Row>
  );
}
function SLADemo() {
  return <SLAIndicator title="Response SLA" textAlternative="2 hours 10 minutes used against a 4 hour service level." current={130} threshold={240} minimum={0} maximum={300} valueLabel="2h 10m used" thresholdLabel="SLA 4h" {...CHART_TEXT} />;
}
function HealthDemo() {
  return (
    <Stack>
      <HealthBadge availability="available" label="Service ERP is available" text="Service ERP" />
      <HealthBadge availability="degraded" label="Parts portal is degraded" text="Parts portal" />
      <HealthBadge availability="unavailable" label="Billing connector is unavailable" text="Billing" />
      <HealthBadge availability="available" connection="reconnecting" label="Checking Service ERP" text="Reconnecting" />
      <HealthBadge availability="available" connection="disconnected" label="Service ERP status feed lost" text="Status unknown" />
    </Stack>
  );
}

const SKELETONS: SkeletonShape[] = ['title', 'body', 'body-short', 'field-label', 'field-value', 'data-value', 'icon', 'avatar', 'action-button', 'context-row'];

export const DEMOS: Readonly<Record<string, Demo>> = {
  Surface: { stage: 'workspace', node: <Row>{(['workspace', 'card', 'panel', 'chrome'] as const).map((role) => <Surface key={role} role={role} bordered padding={4}><span className="type-data">{role}</span></Surface>)}</Row> },
  SectionHeader: { node: <Stack><SectionHeader text="Today summary" size="lg" level={3} /><SectionHeader text="Later today" size="md" level={3} /><SectionHeader text="Job steps" size="sm" level={3} /></Stack> },
  Label: { node: <Label text="Active work order" /> },
  Icon: { node: <Row>{(['clipboard-list', 'box', 'camera', 'check', 'alert-triangle', 'wifi-off', 'sparkles', 'settings'] as const).map((n) => <Icon key={n} name={n} size="lg" label={n.replace('-', ' ')} />)}</Row> },
  Button: { node: <ButtonDemo /> },
  Link: { node: <Row><Link label="Send feedback" onActivate={() => {}} /><Link label="Contact support" href="#" /></Row> },
  KeyValue: { node: <Stack><KeyValue label="Equipment" value="ArcticAir WIF-3" /><KeyValue label="Contact" value="Nina Patel" emphasis /></Stack> },
  DetailRow: { wide: true, node: <Stack><DetailRow label="Site" value="Northgate Grocers #4830" columnContext="multi" status={{ label: 'Priority', tone: 'warning' }} /><DetailRow label="Equipment" value="ArcticAir WIF-3, unit FZ-02" columnContext="multi" /><DetailRow label="Contact" value="Nina Patel" columnContext="multi" status={{ label: 'Confirmed', tone: 'success' }} /></Stack> },
  StatTile: { node: <Row><StatTile label="Jobs today" value={4} /><StatTile label="Late" value={1} caption="1 job is behind" tone="attention" /><StatTile label="Open value" value="$42,860" tone="success" caption="Supplied upstream" /></Row> },
  Avatar: { node: <Avatar initials="MB" label="Marcus Bell" /> },
  RecordList: { node: <RecordListDemo /> },
  HistoryList: { wide: true, node: <HistoryDemo /> },
  WorkflowStepper: { node: <StepperDemo /> },
  TextInput: { node: <TextDemo /> },
  TextArea: { node: <TextAreaDemo /> },
  PasswordInput: { node: <PasswordDemo /> },
  FormField: { node: <FormFieldDemo /> },
  LookupField: { node: <LookupDemo /> },
  PhotoCapture: { node: <PhotoDemo /> },
  ChoiceGroup: { node: <ChoiceDemo /> },
  NumberInput: { node: <NumberDemo /> },
  StatusPill: { node: <Row><StatusPill label="Approved" tone="success" /><StatusPill label="Priority" tone="warning" /><StatusPill label="Rejected" tone="error" /><StatusPill label="Needs review" tone="checkpoint" /><StatusPill label="Draft" tone="neutral" /></Row> },
  StatusIndicator: { node: <Row>{(['success', 'warning', 'error', 'checkpoint', 'inactive', 'loading'] as const).map((s) => <span key={s} className={styles.labeled}><StatusIndicator state={s} label={s} decorative size="md" /><span className="type-caption">{s}</span></span>)}</Row> },
  SyncDot: { node: <Stack><SyncDot freshness="fresh" connectivity="connected" label="Synced" /><SyncDot freshness="syncing" connectivity="reconnecting" label="Syncing" /><SyncDot freshness="stale" connectivity="disconnected" label="Updated 7 minutes ago" /></Stack> },
  Skeleton: { node: <Stack>{SKELETONS.map((s) => <div key={s} className={styles.skeletonRow}><span className="type-caption">{s}</span><Skeleton shape={s} /></div>)}</Stack> },
  Toast: { node: <ToastDemo /> },
  InlineError: { node: <InlineErrorDemo /> },
  DegradedBanner: { node: <DegradedBanner message="Parts availability is read-only right now." actionLabel="Retry connection" onAction={() => {}} /> },
  EmptyState: { node: <EmptyState title="Nothing queued" explanation="Jobs appear here as they are assigned to you." actionLabel="Refresh jobs" onAction={() => {}} /> },
  NavItem: { stage: 'chrome', node: <Row><NavItem id="a" label="Dashboard" icon="layout-dashboard" layout="tab" active onActivate={() => {}} /><NavItem id="b" label="Work Orders" icon="clipboard-list" layout="tab" onActivate={() => {}} /><NavItem id="c" label="Assets" icon="box" layout="tab" unavailable unavailableReason="Assets are unavailable while offline." onActivate={() => {}} /></Row> },
  NavigationRail: { stage: 'frame', node: <NavigationRail items={navItems} ariaLabel="Gallery navigation" onSelect={() => {}} /> },
  TabBar: { stage: 'chrome', node: <TabBar items={tabItems} ariaLabel="Gallery tabs" onSelect={() => {}} menuItemId="more" /> },
  MoreMenu: { node: <MoreMenuDemo /> },
  AssistantPanel: { node: <AssistantDemo /> },
  FeedbackForm: { node: <FeedbackDemo /> },
  CheckpointOverlay: { wide: true, node: <CheckpointDemo /> },
  CheckpointInitializing: { node: <CheckpointInitializing statusMessage={messages.checkpoint.initializing} /> },
  DiffView: { wide: true, node: <DiffView diff={validDiff} labels={messages.checkpoint.diff} /> },
  AccountabilityStatement: { node: <AccountabilityStatement heading={messages.checkpoint.accountabilityHeading} statement={messages.checkpoint.accountability} /> },
  AcknowledgmentControl: { node: <AcknowledgmentDemo /> },
  ConfirmationGesture: { node: <GestureDemo /> },
  DecisionControls: { node: <DecisionDemo /> },
  WidgetContainer: { wide: true, node: <WidgetDemo /> },
  Select: { node: <SelectDemo /> },
  DatePicker: { node: <DateDemo /> },
  HealthBadge: { node: <HealthDemo /> },
  ProgressRing: { node: <RingDemo /> },
  SLAIndicator: { wide: true, node: <SLADemo /> },
  BarChart: { wide: true, node: <ChartsDemo /> },
  LineChart: { wide: true, node: <LineDemo /> },
  DonutChart: { wide: true, node: <DonutDemo /> },
};
