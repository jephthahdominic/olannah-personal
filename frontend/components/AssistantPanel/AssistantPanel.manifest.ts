import { defineComponent } from '../manifest';

export const manifest = defineComponent({
  name: 'AssistantPanel',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'persistence-capable',
  job: 'Gives a worker a place to ask the assistant a question without leaving their work.',
  jobs: [
    'Gives a worker a place to ask the assistant a question without leaving their work.',
    'It is never the main way to use the canvas and is closed until the worker opens it.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'turns', type: 'list of messages with their author and text', required: true, meaning: 'The conversation so far, supplied. The panel renders it and does not hold it as the record.', freshness: 'As delivered.', whenAbsent: 'Shows the empty state.' },
      { field: 'data', type: 'loading, ready or empty', required: true, meaning: 'The condition of the conversation, supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'connection', type: 'connected, reconnecting or disconnected', required: true, meaning: 'The state of the assistant connection, supplied. The panel does not own the connection.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'draft', type: 'text', required: true, meaning: 'What the worker is typing. The composing layer owns it.', freshness: 'As delivered.', whenAbsent: 'Empty.' },
      { field: 'open', type: 'true or false', required: true, meaning: 'Whether the panel is open. The composing layer owns it.', freshness: 'As delivered.', whenAbsent: 'Closed.' },
    ],
  },
  governance: [
    { rule: 'It is secondary: never the default interaction model, never in primary zone space, and not visible until the worker opens it.', source: 'BRD 1.2 5.10.1 Feature 6A; BRD 1.3 sections 6.6 and 7.1' },
    { rule: 'It emits what the worker writes upward and never calls the intelligence layer directly.', source: 'BRD 1.2 5.10.1 Feature 6A; BRD 1.2 5.10 (AssistantPanel, prohibited)' },
    { rule: 'It never owns the connection and never holds the conversation as authoritative.', source: 'BRD 1.2 5.10 (AssistantPanel, prohibited)' },
    { rule: 'It may be preserved across a layout change for continuity only. The shell decides.', source: 'BRD 1.2 5.4; BRD 1.2 5.10 (AssistantPanel, lifecycle)' },
  ],
  gaps: [
    'BRD 1.2 section 7 question 7 (whether history persists within a session) is open.',
  ],
  dimensions: { data: ['loading', 'ready', 'empty'], interaction: ['default', 'focus'], runtime: ['connected', 'reconnecting', 'disconnected'] },
  events: ['open', 'close', 'message-submit', 'continuity'],
  a11y: {
    contrast: 'text 4.5:1; header Warm Cream on Evergreen 7.9:1',
    touchTarget: '44px controls',
    focus: 'trapped while open, Escape closes, focus returns to the opener',
    announcement: 'role=dialog; conversation is role=log aria-live=polite; unread count in the trigger name',
    reducedMotion: 'transitions replaced by 150ms fade',
  },
  prohibited: ['become-primary-interaction-model', 'call-intelligence-layer-directly', 'own-connection', 'hold-conversation-as-authoritative', 'occupy-primary-zone-space', 'elect-own-persistence', 'queue-unsent-messages'],
});
