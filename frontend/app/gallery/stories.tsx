'use client';

import { useState, type ReactNode } from 'react';
import {
  Button, Link, StatTile, Avatar, TextArea, PasswordInput, KeyValue, DetailRow, RecordList, HistoryList, WorkflowStepper, TextInput, FormField,
  LookupField, PhotoCapture, ChoiceGroup, NumberInput, StatusPill, StatusIndicator, SyncDot, Skeleton, Toast, InlineError, DegradedBanner,
  EmptyState, NavItem, NavigationRail, TabBar, MoreMenu, AssistantPanel, FeedbackForm, WidgetContainer, Select, DatePicker, HealthBadge,
  type NavItemModel, type AssistantTurnView,
} from '@/components';
import {
  AccountabilityStatement, AcknowledgmentControl, CheckpointInitializing, CheckpointOverlay, ConfirmationGesture, DecisionControls, DiffView,
} from '@/components/checkpoint';
import { BarChart, DonutChart, LineChart, ProgressRing, SLAIndicator } from '@/components/visualization';
import { messages } from '@/render/messages';
import { validDiff } from '@/contracts/fixtures/checkpoint';
import { ASSISTANT_LABELS, FEEDBACK_LABELS } from './demos';
import { sampleInsightWidget } from './sampleData';
import styles from './demos.module.css';

// One story for EVERY state a component declares in its manifest (BRD 1.2 5.13; ADR-009). A story renders the component in that state from
// SAMPLE data, the way the canvas would supply it. States the browser produces (hover, pressed and keyboard focus) cannot be forced by a
// prop, so their story says how to reach them on the live example. stories.test.ts fails when a declared state has neither.

export interface LiveStory { live: string }
export type Story = ReactNode | LiveStory;
export const isLive = (story: Story): story is LiveStory => typeof story === 'object' && story !== null && 'live' in story;

const live = (how: string): LiveStory => ({ live: how });
const HOVER = live('Move the pointer over it.');
const PRESS = live('Press and hold it.');
const FOCUS = live('Press Tab until it is reached.');
const noop = () => {};

/** Holds an overlay inside the story: a transformed ancestor becomes the containing block of fixed-position children. */
function Contained({ children, minHeight = 30 }: { children: (target: HTMLElement | null) => ReactNode; minHeight?: number }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return <div ref={setEl} className={styles.contain} style={{ blockSize: `${minHeight}rem` }}>{el ? children(el) : null}</div>;
}
const Stack = ({ children }: { children: ReactNode }) => <div className={styles.stack}>{children}</div>;

const WORK_ORDERS = [
  { id: 'wo1', timeLocal: '10:30', title: 'Northgate Grocers #4830', subtitle: 'Walk-in freezer not recovering', status: { label: 'Priority', tone: 'warning' as const } },
  { id: 'wo2', timeLocal: '13:15', title: 'Union Coffee Roasters', subtitle: 'Preventive maintenance', status: { label: 'Approved', tone: 'success' as const } },
];
const HISTORY = [
  { id: 'h1', occurredOn: '2026-09-21', title: 'Recovery exceeded 45 minutes', summary: 'Door left ajar during delivery.' },
  { id: 'h2', occurredOn: '2026-09-04', title: 'Evaporator fan replaced' },
];
const historyProps = {
  records: HISTORY, loadingMore: false, hasMore: false, ariaLabel: 'Service history', degradedMessage: 'Some older visits are not available yet.',
  emptyTitle: 'No history yet', emptyExplanation: 'Visits appear here after the first completed job.', errorTitle: 'History could not be loaded',
  errorExplanation: 'Try again in a moment.', retryLabel: 'Retry history', loadMoreLabel: 'Load more history', loadingLabel: 'Loading history',
  onRetry: noop, onRequestMore: noop,
};
const STEPS = [
  { id: 'arrive', label: 'Arrive on site', completion: 'complete' as const, statusLabel: 'Done', detail: 'Arrived at 8:02 AM.' },
  { id: 'diagnose', label: 'Diagnose', completion: 'incomplete' as const, statusLabel: 'In progress', detail: 'Check the defrost sensor.', advanceLabel: 'Record diagnosis' },
];
const ROUTES: NavItemModel[] = [
  { destinationId: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', active: true },
  { destinationId: 'work-orders', label: 'Work Orders', icon: 'clipboard-list' },
  { destinationId: 'settings', label: 'Settings', icon: 'settings' },
];
const MORE_ACTIONS = [{ id: 'ask', icon: 'sparkles' as const, title: 'Ask Olannah', description: 'Get help with this job' }, { id: 'settings', icon: 'settings' as const, title: 'Settings', description: 'Account and preferences' }];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const QUOTES = [{ id: 'drafted', name: 'Drafted', values: [3, 4, 2, 5, 4] }, { id: 'approved', name: 'Approved', values: [2, 1, 3, 2, null] }];
const EMPTY_TEXT = { emptyTitle: 'No data yet', emptyExplanation: 'Figures appear here once quotes have been drafted this week.' };
const barProps = { title: 'Quotes this week', legendLabel: 'Quote status', categories: WEEK, series: QUOTES, textAlternative: 'Quotes drafted peaked at 5 on Thursday.', ...EMPTY_TEXT };
const lineProps = { title: 'Box temperature recovery', legendLabel: 'Series', xLabels: ['Mon', 'Tue', 'Wed'], series: [{ id: 'box', name: 'Box temp', values: [19, 12, 4] }], textAlternative: 'Box temperature fell from 19 to 4 degrees.', ...EMPTY_TEXT };
const donutProps = { title: 'Packet composition', legendLabel: 'Segments', centerValue: '42', centerCaption: 'packets', textAlternative: '42 packets: 20 complete, 14 in review, 8 blocked.', segments: [{ id: 'complete', label: 'Complete', value: 20 }, { id: 'review', label: 'In review', value: 14 }, { id: 'blocked', label: 'Blocked', value: 8 }], ...EMPTY_TEXT };
const t = messages.checkpoint;
const trigger = { title: t.title, blockingNote: t.blockingNote, triggeredByLabel: t.triggeredByLabel, triggeredBy: 'Close-out workflow', description: 'Closing WO-48213 will update the work order.' };
const decision = (enabled: boolean, deciding: 'approve' | 'reject' | null = null) => (
  <DecisionControls rejectLabel={t.reject} approveLabel={t.approve} approveArmedLabel={t.approveArmed} approveArmedAnnouncement={t.approveArmedAnnouncement} approveDisarmedAnnouncement={t.approveDisarmed} processingLabel={t.submitting} approveEnabled={enabled} deciding={deciding} confirmWindowMs={5000} onApproveIntent={noop} onReject={noop} />
);
const turns: AssistantTurnView[] = [{ id: 't1', role: 'assistant', text: 'Three recent visits mention ice buildup. Bring a defrost control kit.', proactive: true }];
const assistant = (data: 'loading' | 'ready' | 'empty', connection: 'connected' | 'reconnecting' | 'disconnected') => (
  <Contained>{(target) => <AssistantPanel open presentation="floating" showTrigger={false} turns={data === 'ready' ? turns : []} data={data} connection={connection} unread={0} draft="" onDraftChange={noop} onSubmit={noop} onOpen={noop} onClose={noop} onRetryConnection={noop} labels={ASSISTANT_LABELS} portalTarget={target} />}</Contained>
);
const feedback = (status: 'idle' | 'submitting') => (
  <Contained>{(target) => <FeedbackForm open presentation="popover" screenSummary="Component library, Feedback and status" draft="" onDraftChange={noop} status={status} maxLength={500} onSubmit={noop} onDismiss={noop} labels={FEEDBACK_LABELS} portalTarget={target} />}</Contained>
);
const field = (id: string, label: string, control: ReactNode) => <FormField id={id} label={label}>{control}</FormField>;
const selectOptions = [{ value: 'sensor', label: 'Intermittent open sensor' }, { value: 'fan', label: 'Failed fan motor' }];
const select = (id: string, options: typeof selectOptions, extra: { disabled?: boolean } = {}) => field(id, 'Failure condition', <Select id={id} selection={null} onChange={noop} placeholder="Choose a failure condition" emptyLabel="No conditions supplied" options={options} {...extra} />);
const dates = (id: string, extra: { disabled?: boolean } = {}) => field(id, 'Valid through', <DatePicker id={id} meaning="valid-through" value="2026-10-17" onChange={noop} {...extra} />);
const textInput = (id: string, extra: { disabled?: boolean } = {}) => field(id, 'Equipment', <TextInput id={id} value="Walk-in freezer" onChange={noop} {...extra} />);
const choice = (name: string, options: { value: string; label: string }[], extra: { disabled?: boolean } = {}) => (
  <ChoiceGroup legend="Time type" name={name} selection={null} onChange={noop} options={options} emptyTitle="No options" emptyExplanation="Options appear when the job supplies them." {...extra} />
);
const choiceOptions = [{ value: 'travel', label: 'Travel' }, { value: 'onsite', label: 'On site' }];
const number = (id: string, extra: { disabled?: boolean } = {}) => field(id, 'Quantity', <NumberInput id={id} value={2} onChange={noop} minimum={1} maximum={10} {...extra} />);
const lookup = (id: string, data: 'loading' | 'ready' | 'empty' | 'idle', extra: { disabled?: boolean } = {}) => (
  <FormField id={id} label="Work order"><LookupField id={id} query={data === 'idle' ? '' : 'WO'} onQueryChange={noop} data={data} results={data === 'ready' ? [{ id: 'a', label: 'WO-48213', detail: 'Northgate Grocers #4830' }] : []} emptyMessage="No work order matches that number." loadingMessage="Searching work orders" onSelect={noop} {...extra} /></FormField>
);
const photo = (captured: boolean, extra: { disabled?: boolean } = {}) => (
  <PhotoCapture prompt="Photograph the data plate" captureLabel="Take photo" requiredLabel="Required" required captured={captured ? [{ id: 'p1', previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', label: 'Photo 1' }] : []} emptyMessage="No photo yet." onCaptureComplete={noop} {...extra} />
);
const health = (availability: 'available' | 'degraded' | 'unavailable', connection?: 'connected' | 'reconnecting' | 'disconnected') => <HealthBadge availability={availability} connection={connection} label={`Service ERP is ${availability}`} text="Service ERP" />;

// Components outside BRD 1.2 (shown only on /proposed) have stories too, so the same check holds for them.
export const STORIES: Readonly<Record<string, Readonly<Record<string, Story>>>> = {
  StatTile: { ready: <StatTile label="Jobs today" value={4} />, empty: <StatTile label="Jobs today" value="Not available" /> },
  Avatar: { ready: <Avatar initials="MB" label="Marcus Bell" /> },
  TextArea: {
    default: field('s-ta', 'Notes', <TextArea id="s-ta" value="" onChange={noop} rows={3} />), focus: FOCUS,
    disabled: field('s-ta-d', 'Notes', <TextArea id="s-ta-d" value="" onChange={noop} rows={3} disabled />),
  },
  PasswordInput: {
    default: field('s-pw', 'Password', <PasswordInput id="s-pw" autoComplete="current-password" value="" onChange={noop} showLabel="Show password" hideLabel="Hide password" />), focus: FOCUS,
    disabled: field('s-pw-d', 'Password', <PasswordInput id="s-pw-d" autoComplete="current-password" value="" onChange={noop} showLabel="Show password" hideLabel="Hide password" disabled />),
  },
  Surface: {},
  SectionHeader: {},
  Label: {},
  Icon: {},
  Button: {
    default: <Button label="Open work order" />, hover: HOVER, pressed: PRESS, focus: FOCUS,
    disabled: <Button label="Sync unavailable" disabled />, processing: <Button label="Saving note" processing processingLabel="Saving note" />,
  },
  Link: { default: <Link label="Contact support" />, hover: HOVER, focus: FOCUS },
  KeyValue: { ready: <KeyValue label="Site" value="Northgate Grocers #4830" />, empty: <KeyValue label="Site" /> },
  DetailRow: { ready: <DetailRow label="Status" value="Quote sent" status={{ label: 'Approved', tone: 'success' }} />, empty: <DetailRow label="Status" /> },
  RecordList: {
    ready: <RecordList records={WORK_ORDERS} ariaLabel="Later today" emptyTitle="Nothing queued" emptyExplanation="Jobs appear here as they are assigned." onSelect={noop} />,
    empty: <RecordList records={[]} ariaLabel="Later today" emptyTitle="Nothing queued" emptyExplanation="Jobs appear here as they are assigned." />,
    default: <RecordList records={WORK_ORDERS} ariaLabel="Later today" emptyTitle="Nothing queued" emptyExplanation="" onSelect={noop} />, hover: HOVER, focus: FOCUS,
  },
  HistoryList: {
    loading: <HistoryList {...historyProps} status="loading" records={[]} />, ready: <HistoryList {...historyProps} status="ready" />, empty: <HistoryList {...historyProps} status="empty" records={[]} />,
    degraded: <HistoryList {...historyProps} status="degraded" />, error: <HistoryList {...historyProps} status="error" records={[]} />,
    default: <HistoryList {...historyProps} status="ready" />, focus: FOCUS,
  },
  WorkflowStepper: {
    ready: <WorkflowStepper steps={STEPS} activeStepId="diagnose" ariaLabel="Job steps" onAdvance={noop} />,
    empty: <WorkflowStepper steps={[]} activeStepId="" ariaLabel="Job steps" onAdvance={noop} />,
    default: <WorkflowStepper steps={STEPS} activeStepId="diagnose" ariaLabel="Job steps" onAdvance={noop} />, hover: HOVER, focus: FOCUS,
  },
  TextInput: { default: textInput('s-text'), focus: FOCUS, disabled: textInput('s-text-d', { disabled: true }) },
  FormField: {},
  Select: { ready: select('s-sel', selectOptions), empty: select('s-sel-e', []), default: select('s-sel-d', selectOptions), focus: FOCUS, disabled: select('s-sel-x', selectOptions, { disabled: true }) },
  DatePicker: { default: dates('s-date'), focus: FOCUS, disabled: dates('s-date-d', { disabled: true }) },
  LookupField: {
    loading: lookup('s-look-l', 'loading'), ready: lookup('s-look-r', 'ready'), empty: lookup('s-look-e', 'empty'),
    default: lookup('s-look-d', 'idle'), focus: FOCUS, disabled: lookup('s-look-x', 'idle', { disabled: true }),
  },
  PhotoCapture: { empty: photo(false), ready: photo(true), default: photo(false), focus: FOCUS, disabled: photo(false, { disabled: true }) },
  ChoiceGroup: { ready: choice('s-ch-r', choiceOptions), empty: choice('s-ch-e', []), default: choice('s-ch-d', choiceOptions), focus: FOCUS, disabled: choice('s-ch-x', choiceOptions, { disabled: true }) },
  NumberInput: { default: number('s-num'), focus: FOCUS, disabled: number('s-num-d', { disabled: true }) },
  StatusPill: { ready: <StatusPill label="Approved" tone="success" />, empty: <StatusPill label="No status" tone="neutral" /> },
  StatusIndicator: { ready: <StatusIndicator state="success" label="Success" size="md" /> },
  SyncDot: {
    ready: <SyncDot freshness="fresh" connectivity="connected" label="Synced" />, stale: <SyncDot freshness="stale" connectivity="connected" label="Updated earlier" />,
    connected: <SyncDot freshness="fresh" connectivity="connected" label="Connected" />, reconnecting: <SyncDot freshness="syncing" connectivity="reconnecting" label="Reconnecting" />,
    disconnected: <SyncDot freshness="stale" connectivity="disconnected" label="Disconnected" />,
  },
  Skeleton: {},
  Toast: { default: <Toast message="Note saved to the work order." tone="success" dismissLabel="Dismiss message" onDismiss={noop} durationMs={3600000} />, focus: FOCUS },
  InlineError: {
    ready: <InlineError title="The work order could not be saved" body="Your note is still here. Try saving again." retryLabel="Retry saving" onRetry={noop} />,
    default: <InlineError title="The work order could not be saved" retryLabel="Retry saving" onRetry={noop} />, focus: FOCUS,
  },
  DegradedBanner: {
    ready: <DegradedBanner message="Parts availability is read-only right now." dismissLabel="Dismiss" onDismiss={noop} />,
    default: <DegradedBanner message="Parts availability is read-only right now." dismissLabel="Dismiss" onDismiss={noop} />, focus: FOCUS,
  },
  EmptyState: {
    ready: <EmptyState title="Nothing queued" explanation="Jobs appear here as they are assigned." actionLabel="Refresh" onAction={noop} />,
    default: <EmptyState title="Nothing queued" explanation="Jobs appear here as they are assigned." actionLabel="Refresh" onAction={noop} />, focus: FOCUS,
  },
  HealthBadge: {
    ready: health('available'), degraded: health('degraded'), error: health('unavailable'),
    connected: health('available', 'connected'), reconnecting: health('available', 'reconnecting'), disconnected: health('available', 'disconnected'),
  },
  ProgressRing: {
    ready: <ProgressRing value={7} total={10} centeredLabel="70%" textAlternative="Quote completeness: 7 of 10 items complete." size={48} emptyExplanation="No items to count yet." />,
    empty: <ProgressRing value={0} total={0} centeredLabel="" textAlternative="" emptyExplanation="No items to count yet." />,
  },
  SLAIndicator: {
    ready: <SLAIndicator title="Response SLA" textAlternative="2 hours 10 minutes used against a 4 hour service level." current={130} threshold={240} minimum={0} maximum={300} valueLabel="2h 10m used" thresholdLabel="SLA 4h" {...EMPTY_TEXT} />,
    empty: <SLAIndicator title="Response SLA" textAlternative="" status="ready" current={Number.NaN} threshold={240} minimum={0} maximum={300} valueLabel="" thresholdLabel="SLA 4h" {...EMPTY_TEXT} />,
    degraded: <SLAIndicator title="Response SLA" textAlternative="2 hours 10 minutes used against a 4 hour service level." status="degraded" degradedMessage="The clock may be a few minutes behind." current={130} threshold={240} minimum={0} maximum={300} valueLabel="2h 10m used" thresholdLabel="SLA 4h" {...EMPTY_TEXT} />,
  },
  BarChart: {
    loading: <BarChart {...barProps} status="loading" />, ready: <BarChart {...barProps} />, empty: <BarChart {...barProps} series={[]} />,
    degraded: <BarChart {...barProps} status="degraded" degradedMessage="Friday figures are not in yet." />, default: <BarChart {...barProps} />, focus: FOCUS,
  },
  LineChart: {
    loading: <LineChart {...lineProps} status="loading" />, ready: <LineChart {...lineProps} />, empty: <LineChart {...lineProps} series={[]} />,
    degraded: <LineChart {...lineProps} status="degraded" degradedMessage="The last reading is missing." />, default: <LineChart {...lineProps} />, focus: FOCUS,
  },
  DonutChart: {
    loading: <DonutChart {...donutProps} status="loading" />, ready: <DonutChart {...donutProps} />, empty: <DonutChart {...donutProps} segments={[]} />,
    degraded: <DonutChart {...donutProps} status="degraded" degradedMessage="Some packets are not counted yet." />, default: <DonutChart {...donutProps} />, focus: FOCUS,
  },
  CheckpointOverlay: {
    loading: <Contained minHeight={22}>{() => <CheckpointOverlay {...trigger}><CheckpointInitializing statusMessage={t.initializing} /></CheckpointOverlay>}</Contained>,
    ready: <Contained minHeight={44}>{() => <CheckpointOverlay {...trigger}><DiffView diff={validDiff} labels={t.diff} /><AccountabilityStatement heading={t.accountabilityHeading} statement={t.accountability} />{decision(false)}</CheckpointOverlay>}</Contained>,
    error: <Contained minHeight={22}>{() => <CheckpointOverlay {...trigger}><InlineError title="The change could not be prepared" body="Nothing was written. You can close this and try again." /></CheckpointOverlay>}</Contained>,
    default: <Contained minHeight={22}>{() => <CheckpointOverlay {...trigger}><CheckpointInitializing statusMessage={t.initializing} /></CheckpointOverlay>}</Contained>, focus: FOCUS,
  },
  CheckpointInitializing: { loading: <CheckpointInitializing statusMessage={t.initializing} /> },
  DiffView: { ready: <DiffView diff={validDiff} labels={t.diff} /> },
  AccountabilityStatement: { ready: <AccountabilityStatement heading={t.accountabilityHeading} statement={t.accountability} /> },
  AcknowledgmentControl: {
    default: <AcknowledgmentControl statement={t.acknowledgment} checkpointId="s-ack" acknowledged={false} onAcknowledge={noop} />, focus: FOCUS,
    disabled: <AcknowledgmentControl statement={t.acknowledgment} checkpointId="s-ack-d" acknowledged={false} disabled onAcknowledge={noop} />,
  },
  ConfirmationGesture: {
    default: <ConfirmationGesture label={t.approve} armedLabel={t.approveArmed} armedAnnouncement={t.approveArmedAnnouncement} disarmedAnnouncement={t.approveDisarmed} processingLabel={t.submitting} windowMs={5000} enabled onComplete={noop} />,
    pressed: live('Press it once. It arms and waits for a second press.'),
    processing: <ConfirmationGesture label={t.approve} armedLabel={t.approveArmed} armedAnnouncement={t.approveArmedAnnouncement} disarmedAnnouncement={t.approveDisarmed} processingLabel={t.submitting} windowMs={5000} enabled processing onComplete={noop} />,
  },
  DecisionControls: { default: decision(true), focus: FOCUS, disabled: decision(false), processing: decision(true, 'approve') },
  AssistantPanel: {
    loading: assistant('loading', 'connected'), ready: assistant('ready', 'connected'), empty: assistant('empty', 'connected'),
    default: assistant('ready', 'connected'), focus: FOCUS,
    connected: assistant('ready', 'connected'), reconnecting: assistant('ready', 'reconnecting'), disconnected: assistant('ready', 'disconnected'),
  },
  FeedbackForm: { default: feedback('idle'), focus: FOCUS, processing: feedback('submitting') },
  WidgetContainer: {
    loading: <Skeleton shape="card" />,
    ready: <WidgetContainer widget={sampleInsightWidget} headerLabel="Olannah Insight" fallbackTitle="This insight cannot be shown" fallbackMessage="The rest of your work is not affected." />,
    empty: <WidgetContainer widget={{ ...sampleInsightWidget, condition: 'empty' }} headerLabel="Olannah Insight" fallbackTitle="No insight yet" fallbackMessage="Nothing to show for this job yet." />,
    degraded: <WidgetContainer widget={{ ...sampleInsightWidget, condition: 'degraded', degradedMessage: 'Built from partial history.' }} headerLabel="Olannah Insight" fallbackTitle="This insight cannot be shown" fallbackMessage="The rest of your work is not affected." />,
    error: <WidgetContainer widget={{ type: 'insight', schemaVersion: '1.0', payload: { broken: true } }} headerLabel="Olannah Insight" fallbackTitle="This insight cannot be shown" fallbackMessage="The rest of your work is not affected." />,
    unsupported: <WidgetContainer widget={{ type: 'forecast', schemaVersion: '9.0', payload: {} }} headerLabel="Olannah Insight" fallbackTitle="This insight cannot be shown" fallbackMessage="The rest of your work is not affected." />,
  },
  NavItem: {
    default: <Stack><NavItem {...ROUTES[1]} layout="rail" onActivate={noop} /></Stack>, hover: HOVER, pressed: PRESS, focus: FOCUS,
    disabled: <NavItem destinationId="assets" label="Assets" icon="box" unavailable unavailableReason="Assets are unavailable while offline." layout="rail" onActivate={noop} />,
  },
  NavigationRail: { ready: <NavigationRail items={ROUTES} onSelect={noop} ariaLabel="Main" />, empty: <NavigationRail items={[]} onSelect={noop} ariaLabel="Main" /> },
  TabBar: { ready: <TabBar items={ROUTES.filter((i) => i.destinationId !== 'settings')} onSelect={noop} ariaLabel="Main" />, empty: <TabBar items={[]} onSelect={noop} ariaLabel="Main" /> },
  MoreMenu: {
    ready: <Contained>{(target) => <MoreMenu open actions={MORE_ACTIONS} onCloseRequest={noop} onActionSelect={noop} onDestinationSelect={noop} portalTarget={target} />}</Contained>,
    empty: <Contained>{(target) => <MoreMenu open actions={[]} onCloseRequest={noop} onActionSelect={noop} onDestinationSelect={noop} portalTarget={target} />}</Contained>,
    default: <Contained>{(target) => <MoreMenu open actions={MORE_ACTIONS} onCloseRequest={noop} onActionSelect={noop} onDestinationSelect={noop} portalTarget={target} />}</Contained>, focus: FOCUS,
  },
};
