import { defineComponent, NA } from '../../manifest';

export const manifest = defineComponent({
  name: 'ConfirmationGesture',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Makes a worker confirm approval with a second deliberate action, so one tap cannot approve.',
  jobs: [
    'Makes a worker confirm approval with a second, deliberate action, so a single accidental tap cannot approve a change.',
    'It applies to approval only. Rejection needs no second step.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'label', type: 'text', required: true, meaning: 'The name of the action being confirmed. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'enabled', type: 'true or false', required: true, meaning: 'Whether the gesture can start. Supplied.', freshness: 'As delivered.', whenAbsent: 'Disabled.' },
      { field: 'windowMs', type: 'number of milliseconds', required: true, meaning: 'How long the second interaction is accepted. Supplied upstream.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'processing', type: 'true or false', required: false, meaning: 'Whether the confirmed action is being carried out.', freshness: 'As delivered.', whenAbsent: 'Not processing.' },
    ],
  },
  governance: [
    { rule: 'A single interaction never emits approval. The gesture completes only through a deliberate second worker action.', source: 'BRD 1.2 5.10.1 Feature 2A; BRD 1.2 5.10 (ConfirmationGesture, prohibited)' },
    { rule: 'It never decides that approval is valid.', source: 'BRD 1.2 5.10 (ConfirmationGesture, prohibited)' },
    { rule: 'It does not apply to rejection.', source: 'BRD 1.2 5.10 (ConfirmationGesture, prohibited)' },
  ],
  dimensions: { data: NA, interaction: ['default', 'pressed', 'processing'], runtime: NA },
  events: ['gesture-complete'],
  a11y: {
    contrast: 'Warm Cream on Evergreen 4.5:1',
    touchTarget: '44px',
    focus: 'visible two-tone ring; keyboard and touch use the same two-step action',
    announcement: 'arming and timing out are announced through role=status',
    reducedMotion: 'label change is instant',
  },
  prohibited: ['decide-approval-is-valid', 'emit-on-a-single-interaction', 'apply-to-rejection', 'complete-without-a-deliberate-worker-action'],
});
