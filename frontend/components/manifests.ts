// Every component's manifest, collected. Each one lives beside its component (Button/Button.manifest.ts); see manifest.ts for what they say.
// manifests.test.ts fails if a component is exported without a manifest, if a manifest file is missing from this list, or if a dimension or
// obligation is left undeclared.
import type { ComponentManifest } from './manifest';
export type { Category, ComponentManifest, ContractField, DataContract, GovernanceRule } from './manifest';
export { isSpecified } from './manifest';

import { manifest as Surface } from './Surface/Surface.manifest';
import { manifest as SectionHeader } from './SectionHeader/SectionHeader.manifest';
import { manifest as Label } from './Label/Label.manifest';
import { manifest as Icon } from './Icon/Icon.manifest';
import { manifest as Button } from './Button/Button.manifest';
import { manifest as Link } from './Link/Link.manifest';
import { manifest as KeyValue } from './KeyValue/KeyValue.manifest';
import { manifest as StatTile } from './StatTile/StatTile.manifest';
import { manifest as RecordList } from './RecordList/RecordList.manifest';
import { manifest as HistoryList } from './HistoryList/HistoryList.manifest';
import { manifest as Select } from './Select/Select.manifest';
import { manifest as DatePicker } from './DatePicker/DatePicker.manifest';
import { manifest as HealthBadge } from './HealthBadge/HealthBadge.manifest';
import { manifest as ProgressRing } from './visualization/ProgressRing.manifest';
import { manifest as SLAIndicator } from './visualization/SLAIndicator.manifest';
import { manifest as BarChart } from './visualization/BarChart.manifest';
import { manifest as LineChart } from './visualization/LineChart.manifest';
import { manifest as DonutChart } from './visualization/DonutChart.manifest';
import { manifest as TextInput } from './TextInput/TextInput.manifest';
import { manifest as TextArea } from './TextArea/TextArea.manifest';
import { manifest as DetailRow } from './DetailRow/DetailRow.manifest';
import { manifest as WorkflowStepper } from './WorkflowStepper/WorkflowStepper.manifest';
import { manifest as LookupField } from './LookupField/LookupField.manifest';
import { manifest as PhotoCapture } from './PhotoCapture/PhotoCapture.manifest';
import { manifest as ChoiceGroup } from './ChoiceGroup/ChoiceGroup.manifest';
import { manifest as NumberInput } from './NumberInput/NumberInput.manifest';
import { manifest as CheckpointOverlay } from './checkpoint/CheckpointOverlay/CheckpointOverlay.manifest';
import { manifest as CheckpointInitializing } from './checkpoint/CheckpointInitializing/CheckpointInitializing.manifest';
import { manifest as DiffView } from './checkpoint/DiffView/DiffView.manifest';
import { manifest as AccountabilityStatement } from './checkpoint/AccountabilityStatement/AccountabilityStatement.manifest';
import { manifest as AcknowledgmentControl } from './checkpoint/AcknowledgmentControl/AcknowledgmentControl.manifest';
import { manifest as ConfirmationGesture } from './checkpoint/ConfirmationGesture/ConfirmationGesture.manifest';
import { manifest as DecisionControls } from './checkpoint/DecisionControls/DecisionControls.manifest';
import { manifest as AssistantPanel } from './AssistantPanel/AssistantPanel.manifest';
import { manifest as FeedbackForm } from './FeedbackForm/FeedbackForm.manifest';
import { manifest as WidgetContainer } from './WidgetContainer/WidgetContainer.manifest';
import { manifest as PasswordInput } from './PasswordInput/PasswordInput.manifest';
import { manifest as FormField } from './FormField/FormField.manifest';
import { manifest as StatusPill } from './StatusPill/StatusPill.manifest';
import { manifest as StatusIndicator } from './StatusIndicator/StatusIndicator.manifest';
import { manifest as SyncDot } from './SyncDot/SyncDot.manifest';
import { manifest as Skeleton } from './Skeleton/Skeleton.manifest';
import { manifest as Toast } from './Toast/Toast.manifest';
import { manifest as InlineError } from './InlineError/InlineError.manifest';
import { manifest as DegradedBanner } from './DegradedBanner/DegradedBanner.manifest';
import { manifest as EmptyState } from './EmptyState/EmptyState.manifest';
import { manifest as Avatar } from './Avatar/Avatar.manifest';
import { manifest as NavItem } from './NavItem/NavItem.manifest';
import { manifest as NavigationRail } from './NavigationRail/NavigationRail.manifest';
import { manifest as TabBar } from './TabBar/TabBar.manifest';
import { manifest as MoreMenu } from './MoreMenu/MoreMenu.manifest';

const every: readonly ComponentManifest[] = [Surface, SectionHeader, Label, Icon, Button, Link, KeyValue, StatTile, RecordList, HistoryList, Select, DatePicker, HealthBadge, ProgressRing, SLAIndicator, BarChart, LineChart, DonutChart, TextInput, TextArea, DetailRow, WorkflowStepper, LookupField, PhotoCapture, ChoiceGroup, NumberInput, CheckpointOverlay, CheckpointInitializing, DiffView, AccountabilityStatement, AcknowledgmentControl, ConfirmationGesture, DecisionControls, AssistantPanel, FeedbackForm, WidgetContainer, PasswordInput, FormField, StatusPill, StatusIndicator, SyncDot, Skeleton, Toast, InlineError, DegradedBanner, EmptyState, Avatar, NavItem, NavigationRail, TabBar, MoreMenu];

// The library holds ONLY components named in BRD 1.2. These four were built from approved designs or from the build's own judgement and are not
// in the BRD (BRD 1.2 V2, section 5.1.1; audit/components.json). They stay buildable so the screens that need them keep working, but they are held OUT of the library
// (`manifests`) and listed on the proposed page (/proposed) for the spec team to rule on. A name leaves this list only when 1.2 names it.
export const PROPOSED_COMPONENTS: readonly string[] = ['StatTile', 'Avatar', 'PasswordInput', 'TextArea'];

const indexed = (list: readonly ComponentManifest[]): Readonly<Record<string, ComponentManifest>> => Object.fromEntries(list.map((m) => [m.name, m]));
export const manifests: Readonly<Record<string, ComponentManifest>> = indexed(every.filter((m) => !PROPOSED_COMPONENTS.includes(m.name)));
export const proposedManifests: Readonly<Record<string, ComponentManifest>> = indexed(every.filter((m) => PROPOSED_COMPONENTS.includes(m.name)));
