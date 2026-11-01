import { defineComponent, NA } from '../../manifest';

export const manifest = defineComponent({
  name: 'AcknowledgmentControl',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker confirm they reviewed the change before they can approve it.',
  jobs: [
    'Lets a worker confirm they reviewed the change before they can approve it, with one deliberate action.',
    'It states what the confirmation means and does not claim the worker read the change.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'statement', type: 'text', required: true, meaning: 'The fixed confirmation statement, identical for every checkpoint. Supplied; never authored here.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'checkpointId', type: 'text', required: true, meaning: 'The checkpoint this acknowledgment belongs to. A new id resets it.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'acknowledged', type: 'true or false', required: true, meaning: 'Whether the worker has acknowledged, as the canvas holds it.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'disabled', type: 'true or false', required: false, meaning: 'Whether no action is possible right now.', freshness: 'As delivered.', whenAbsent: 'Enabled.' },
    ],
  },
  governance: [
    { rule: 'It emits an acknowledge event only on the worker\'s explicit action and never computes whether the diff was viewed or approval is eligible.', source: 'BRD 1.2 5.10.1 Feature 8A' },
    { rule: 'Acknowledging does not enable approve directly. It resolves the checkpoint\'s acknowledgment state, which the canvas turns into approveEnabled.', source: 'BRD 1.2 5.10.1 Feature 8B' },
    { rule: 'Acknowledgment is scoped to the checkpoint id. A new id resets it.', source: 'BRD 1.2 5.10.1 Feature 8C; BRD 1.3 section 8.7' },
    { rule: 'It renders the supplied statement identically for every checkpoint.', source: 'BRD 1.2 5.10.1 Feature 8D' },
    { rule: 'It is interactive only when the checkpoint is ready, never while it is initializing.', source: 'BRD 1.2 5.10.1 Feature 9A' },
  ],
  dimensions: { data: NA, interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['acknowledge'],
  a11y: {
    contrast: 'text 4.5:1 on Sage Mist; toggle 3:1',
    touchTarget: 'the whole container is the 44px target',
    focus: 'single Tab stop between the diff and the decision controls; visible two-tone ring',
    announcement: 'role=checkbox, aria-checked, aria-label is the full confirmation text',
    reducedMotion: 'toggle and border change instantly',
  },
  prohibited: ['compute-whether-the-diff-was-viewed', 'author-the-confirmation-statement', 'persist-across-a-new-checkpoint-id', 'derive-own-enablement', 'enable-approve-directly'],
});
