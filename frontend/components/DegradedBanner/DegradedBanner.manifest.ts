import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'DegradedBanner',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker a source is limited right now, so they do not mistake it for a failure.',
  jobs: [
    'Tells a worker a source is limited or read-only right now, so they know to expect less rather than think something broke.',
    'It is clearly different from a failure, and can offer one action.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'message', type: 'text', required: true, meaning: 'The limitation and what it affects, in plain words. Supplied; never inferred.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'dismissLabel', type: 'text', required: false, meaning: 'The label of the dismiss control. Supplied.', freshness: 'As delivered.', whenAbsent: 'No dismiss control is shown.' },
    ],
  },
  governance: [
    { rule: 'A degraded source looks different from a failure, through the semantic warning token, a shape and a label.', source: 'BRD 1.2 5.8.1 Feature 1A; BRD 1.3 section 7.4' },
    { rule: 'It never presents stale data as current and never derives the degraded condition.', source: 'BRD 1.2 5.8 (DegradedBanner, prohibited); BRD 1.2 5.8.1 Feature 1C' },
    { rule: 'It can be dismissed, and the dismissal is an event the canvas handles.', source: 'BRD 1.2 5.8 (DegradedBanner, events)' },
  ],
  dimensions: { data: ['ready'], interaction: ['default', 'focus'], runtime: NA },
  events: ['dismiss'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px actions',
    focus: 'visible keyboard focus ring',
    announcement: 'role=status',
    reducedMotion: NA,
  },
  prohibited: ['render-as-failure', 'present-stale-as-current', 'derive-degraded-condition'],
});
