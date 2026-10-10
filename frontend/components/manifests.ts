// Machine-readable component manifests (BRD 1.2 5.2 and 5.14, SDD ADR-009 and 9.2). A manifest is the executable form of
// the specification block in 1.2: one category, a lifecycle, the state dimensions (every inapplicable one marked
// 'not-applicable', never omitted), emitted events, accessibility obligations, and prohibited behaviors.
// manifests.test.ts fails if a component is exported without a manifest or leaves a dimension or obligation undeclared.

export type Category = 'foundation' | 'data-display' | 'input-control' | 'feedback-status' | 'visualization' | 'system-surface' | 'widget';
export type NA = 'not-applicable';

export interface ComponentManifest {
  name: string;
  category: Category;
  /** P0 renders in the technician flow. P0.5 renders only in the estimator flow. */
  priority: 'P0' | 'P0.5';
  personas: ('technician' | 'estimator')[];
  lifecycle: 'ephemeral' | 'persistence-capable';
  dimensions: { data: readonly string[] | NA; interaction: readonly string[] | NA; runtime: readonly string[] | NA };
  events: readonly string[];
  a11y: { contrast: string | NA; touchTarget: string | NA; focus: string | NA; announcement: string | NA; reducedMotion: string | NA };
  prohibited: readonly string[];
}

const both = ['technician', 'estimator'] as const satisfies readonly ('technician' | 'estimator')[];
const na: NA = 'not-applicable';
const INTERACTION = ['default', 'hover', 'pressed', 'focus', 'disabled', 'processing'] as const;

const m = (x: ComponentManifest): ComponentManifest => x;

export const manifests: Readonly<Record<string, ComponentManifest>> = {
  Surface: m({ name: 'Surface', category: 'foundation', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'text 4.5:1 on its surface', touchTarget: na, focus: na, announcement: na, reducedMotion: na },
    prohibited: ['structural-background-outside-four-surface-tokens', 'shadow-or-elevation', 'outer-margin'] }),
  SectionHeader: m({ name: 'SectionHeader', category: 'foundation', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'text 4.5:1', touchTarget: na, focus: na, announcement: 'semantic heading level', reducedMotion: na },
    prohibited: ['size-outside-sm-to-lg', 'carry-data-values'] }),
  Label: m({ name: 'Label', category: 'foundation', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'secondary text 4.5:1', touchTarget: na, focus: na, announcement: 'plain text', reducedMotion: na },
    prohibited: ['substitute-for-form-label'] }),
  Icon: m({ name: 'Icon', category: 'foundation', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'inherits context color', touchTarget: na, focus: na, announcement: 'aria-label when informative, aria-hidden when decorative', reducedMotion: na },
    prohibited: ['non-tabler-glyph', 'filled-glyph', 'hardcoded-color', 'unmarked-decorative-icon'] }),
  Button: m({ name: 'Button', category: 'foundation', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: INTERACTION, runtime: na }, events: ['activate'],
    a11y: { contrast: 'text 4.5:1 on fill', touchTarget: '44px minimum', focus: 'visible keyboard focus ring', announcement: 'aria-busy while processing', reducedMotion: 'transitions replaced by 150ms fade' },
    prohibited: ['execute-business-consequence', 'touch-target-below-44px', 'mechanism-named-label', 'interactive-while-processing'] }),
  Link: m({ name: 'Link', category: 'foundation', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: ['default', 'hover', 'focus'], runtime: na }, events: ['activate'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px minimum', focus: 'visible keyboard focus ring', announcement: 'link name', reducedMotion: na },
    prohibited: ['styled-as-button', 'carry-write-or-destructive-action'] }),
  KeyValue: m({ name: 'KeyValue', category: 'data-display', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'empty'], interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'text 4.5:1', touchTarget: na, focus: na, announcement: 'label then value', reducedMotion: na },
    prohibited: ['reformat-value-into-other-meaning', 'placeholder-for-absent-value'] }),
  StatTile: m({ name: 'StatTile', category: 'data-display', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'empty'], interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'text 4.5:1 (caption uses the dark amber text token on attention)', touchTarget: na, focus: na, announcement: 'value then label then caption', reducedMotion: na },
    prohibited: ['compute-value', 'emphasis-by-color-alone', 'placeholder-for-absent-value'] }),
  RecordList: m({ name: 'RecordList', category: 'data-display', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'empty'], interaction: ['default', 'hover', 'focus'], runtime: na }, events: ['row-select'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px rows', focus: 'visible keyboard focus ring on selectable rows', announcement: 'labelled list; rows are buttons when selectable', reducedMotion: na },
    prohibited: ['sort-or-filter-for-correctness', 'fetch-records', 'compute-count-or-summary', 'render-blank-when-empty'] }),
  HistoryList: m({ name: 'HistoryList', category: 'data-display', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['loading', 'ready', 'empty', 'degraded', 'error'], interaction: ['default', 'focus'], runtime: na }, events: ['row-select', 'request-more'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px actions', focus: 'visible keyboard focus ring; a button replaces scroll loading where the observer is missing', announcement: 'labelled list; loading is role=status and aria-busy', reducedMotion: 'shimmer stops' },
    prohibited: ['resolve-history-pointer', 'request-history-directly', 'derive-trend-or-summary', 'render-blank-between-render-and-delivery', 'infer-degraded'] }),
  TextInput: m({ name: 'TextInput', category: 'input-control', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: ['default', 'focus', 'disabled'], runtime: na }, events: ['change'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px minimum', focus: 'visible keyboard focus ring', announcement: 'label via FormField, aria-invalid and aria-describedby', reducedMotion: na },
    prohibited: ['hold-value-as-authoritative', 'write-anywhere', 'placeholder-as-label'] }),
  TextArea: m({ name: 'TextArea', category: 'input-control', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: ['default', 'focus', 'disabled'], runtime: na }, events: ['change'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px minimum', focus: 'visible keyboard focus ring', announcement: 'label via FormField, aria-invalid and aria-describedby', reducedMotion: na },
    prohibited: ['hold-value-as-authoritative', 'write-anywhere', 'placeholder-as-label', 'decide-business-validity'] }),
  AssistantPanel: m({ name: 'AssistantPanel', category: 'system-surface', priority: 'P0', personas: [...both], lifecycle: 'persistence-capable',
    dimensions: { data: ['loading', 'ready', 'empty'], interaction: ['default', 'focus'], runtime: ['connected', 'reconnecting', 'disconnected'] }, events: ['open', 'close', 'message-submit', 'continuity'],
    a11y: { contrast: 'text 4.5:1; header Warm Cream on Evergreen 7.9:1', touchTarget: '44px controls', focus: 'trapped while open, Escape closes, focus returns to the opener', announcement: 'role=dialog; conversation is role=log aria-live=polite; unread count in the trigger name', reducedMotion: 'transitions replaced by 150ms fade' },
    prohibited: ['become-primary-interaction-model', 'call-intelligence-layer-directly', 'own-connection', 'hold-conversation-as-authoritative', 'occupy-primary-zone-space', 'elect-own-persistence', 'queue-unsent-messages'] }),
  FeedbackForm: m({ name: 'FeedbackForm', category: 'system-surface', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: ['default', 'focus', 'processing'], runtime: na }, events: ['submit', 'dismiss'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px controls', focus: 'trapped while open, Escape closes, focus returns to the opener', announcement: 'role=dialog; submission failure is role=alert; success is role=status', reducedMotion: 'transitions replaced by 150ms fade' },
    prohibited: ['hold-draft-as-authoritative', 'decide-submission-success', 'require-manual-screen-description', 'capture-screenshot'] }),
  WidgetContainer: m({ name: 'WidgetContainer', category: 'widget', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['loading', 'ready', 'empty', 'degraded', 'error', 'unsupported'], interaction: na, runtime: na }, events: ['diagnostic'],
    a11y: { contrast: 'text 4.5:1', touchTarget: na, focus: na, announcement: 'plain text; fallback is plain language with no schema or type', reducedMotion: na },
    prohibited: ['derive-business-meaning', 'infer-degradation', 'execute-action', 'render-action-control', 'render-unknown-payload-as-guess', 'widget-local-primitives', 'hold-payload-as-authoritative', 'expose-schema-version-or-type'] }),
  PasswordInput: m({ name: 'PasswordInput', category: 'input-control', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: ['default', 'focus', 'disabled'], runtime: na }, events: ['change'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px field and toggle', focus: 'visible keyboard focus ring', announcement: 'label via FormField, toggle uses aria-pressed and a supplied name', reducedMotion: na },
    prohibited: ['hold-value-as-authoritative', 'log-or-store-value', 'block-paste', 'placeholder-as-label'] }),
  FormField: m({ name: 'FormField', category: 'input-control', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'text 4.5:1', touchTarget: na, focus: 'inherited from control', announcement: 'visible label associated by id', reducedMotion: na },
    prohibited: ['compute-business-validity', 'placeholder-as-label', 'own-control-value'] }),
  StatusPill: m({ name: 'StatusPill', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'empty'], interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'text 4.5:1 on tint', touchTarget: na, focus: na, announcement: 'visible text', reducedMotion: na },
    prohibited: ['derive-status', 'meaning-by-color-alone'] }),
  StatusIndicator: m({ name: 'StatusIndicator', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready'], interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'shape 3:1', touchTarget: na, focus: na, announcement: 'role=img with supplied label, or aria-hidden when decorative', reducedMotion: 'loading ring stops' },
    prohibited: ['compute-state', 'substitute-shape', 'state-by-color-alone'] }),
  SyncDot: m({ name: 'SyncDot', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'stale'], interaction: na, runtime: ['connected', 'reconnecting', 'disconnected'] }, events: [],
    a11y: { contrast: 'text 4.5:1', touchTarget: na, focus: na, announcement: 'visible text label', reducedMotion: na },
    prohibited: ['derive-freshness', 'conflate-freshness-with-connectivity', 'present-stale-as-fresh'] }),
  Skeleton: m({ name: 'Skeleton', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: na, runtime: na }, events: [],
    a11y: { contrast: na, touchTarget: na, focus: na, announcement: 'aria-hidden', reducedMotion: 'shimmer stops' },
    prohibited: ['shimmer-on-action-button-or-card-frame', 'represent-action-processing', 'persist-after-content-resolves'] }),
  Toast: m({ name: 'Toast', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: ['default', 'focus'], runtime: na }, events: ['dismiss'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px dismiss', focus: 'timer pauses on focus and hover', announcement: 'role=status', reducedMotion: na },
    prohibited: ['generate-message-from-code', 'block-interaction', 'persist-beyond-duration', 'obscure-checkpoint'] }),
  InlineError: m({ name: 'InlineError', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready'], interaction: ['default', 'focus'], runtime: na }, events: ['retry', 'dismiss'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px actions', focus: 'visible keyboard focus ring', announcement: 'role=alert for failure, role=status for degraded', reducedMotion: na },
    prohibited: ['map-code-to-message', 'expose-internal-codes', 'color-alone'] }),
  DegradedBanner: m({ name: 'DegradedBanner', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready'], interaction: ['default', 'focus'], runtime: na }, events: ['action', 'secondary', 'secondary-link'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px actions', focus: 'visible keyboard focus ring', announcement: 'role=status', reducedMotion: na },
    prohibited: ['render-as-failure', 'present-stale-as-current', 'derive-degraded-condition'] }),
  EmptyState: m({ name: 'EmptyState', category: 'feedback-status', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready'], interaction: ['default', 'focus'], runtime: na }, events: ['action'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px action', focus: 'visible keyboard focus ring', announcement: 'plain text explanation', reducedMotion: na },
    prohibited: ['render-blank', 'invent-explanation', 'error-or-warning-token'] }),
  Avatar: m({ name: 'Avatar', category: 'data-display', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready'], interaction: na, runtime: na }, events: [],
    a11y: { contrast: 'text 4.5:1', touchTarget: na, focus: na, announcement: 'role=img with full name', reducedMotion: na },
    prohibited: ['derive-initials-from-name'] }),
  NavItem: m({ name: 'NavItem', category: 'system-surface', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: na, interaction: ['default', 'hover', 'pressed', 'focus', 'disabled'], runtime: na }, events: ['activate'],
    a11y: { contrast: 'Warm Cream 9.6:1 on Evergreen Dark; indicator 3:1', touchTarget: '44px minimum', focus: 'visible keyboard focus ring', announcement: 'aria-current for active, aria-describedby reason for unavailable', reducedMotion: 'transitions replaced by 150ms fade' },
    prohibited: ['determine-active', 'determine-unavailable', 'perform-route-transition', 'dim-unavailable', 'active-by-color-alone'] }),
  NavigationRail: m({ name: 'NavigationRail', category: 'system-surface', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'empty'], interaction: na, runtime: na }, events: ['item-select'],
    a11y: { contrast: 'Warm Cream 9.6:1', touchTarget: '44px items', focus: 'document order', announcement: 'labelled navigation landmark', reducedMotion: na },
    prohibited: ['reorder-or-filter-items', 'resolve-persona-visibility', 'own-route-transition'] }),
  TabBar: m({ name: 'TabBar', category: 'system-surface', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'empty'], interaction: na, runtime: na }, events: ['item-select'],
    a11y: { contrast: 'Warm Cream 9.6:1', touchTarget: '44px items', focus: 'document order', announcement: 'labelled navigation landmark', reducedMotion: na },
    prohibited: ['reorder-or-filter-items', 'resolve-persona-set', 'own-route-transition'] }),
  MoreMenu: m({ name: 'MoreMenu', category: 'system-surface', priority: 'P0', personas: [...both], lifecycle: 'ephemeral',
    dimensions: { data: ['ready', 'empty'], interaction: ['default', 'focus'], runtime: na }, events: ['close-request', 'action-select', 'destination-select'],
    a11y: { contrast: 'text 4.5:1', touchTarget: '44px items', focus: 'focus moves in, is trapped, and returns to the opener', announcement: 'role=menu', reducedMotion: 'transitions replaced by 150ms fade' },
    prohibited: ['own-authoritative-open-state', 'vary-actions-by-role', 'derive-overflow', 'own-route-transition'] }),
};
