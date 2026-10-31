import { defineComponent, NA } from '../../manifest';

export const manifest = defineComponent({
  name: 'DecisionControls',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Gives a worker the two choices at a checkpoint, approve or reject, and nothing else.',
  jobs: [
    'Gives a worker the two choices at a checkpoint, approve or reject, and nothing else.',
    'Approve stays unavailable until the canvas says it can be used.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'approveEnabled', type: 'true or false', required: true, meaning: 'Whether approve can be used. Resolved upstream from the acknowledgment state and any other condition. Never worked out here.', freshness: 'As delivered.', whenAbsent: 'Approve is unavailable.' },
      { field: 'approveLabel, rejectLabel', type: 'text', required: true, meaning: 'Specific labels for the two choices. Supplied; never yes, no, ok or cancel.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'confirmWindowMs', type: 'number of milliseconds', required: true, meaning: 'How long the second interaction is accepted. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
    ],
  },
  governance: [
    { rule: 'It offers approve and reject only, and no other action while the checkpoint is active.', source: 'BRD 1.2 5.10.1 Feature 2A; BRD 1.2 5.10 (DecisionControls, prohibited)' },
    { rule: 'Approval needs the confirmation gesture to complete first. Rejection emits on a single interaction.', source: 'BRD 1.2 5.10.1 Feature 2A' },
    { rule: 'Approve is unreachable until approveEnabled resolves true upstream. The component never infers it.', source: 'BRD 1.2 5.10.1 Feature 2B' },
    { rule: 'It never pre-focuses either control and never uses generic labels.', source: 'BRD 1.2 5.10 (DecisionControls, prohibited)' },
  ],
  gaps: [
    'BRD 1.4 was not provided. The 100ms event emission target is named in BRD 1.2 section 6.',
  ],
  dimensions: { data: NA, interaction: ['default', 'focus', 'disabled', 'processing'], runtime: NA },
  events: ['approve-intent', 'reject'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px controls',
    focus: 'neither control is pre-focused; reject is first in focus order',
    announcement: 'approve exposes its disabled state programmatically; processing sets aria-busy',
    reducedMotion: NA,
  },
  prohibited: ['offer-any-action-beyond-approve-and-reject', 'infer-approval-eligibility', 'pre-focus-either-control', 'generic-labels', 'emit-approval-without-the-confirmation-gesture'],
});
