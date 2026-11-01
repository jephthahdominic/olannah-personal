import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'SLAIndicator',
  category: 'visualization',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows an estimator how much time is left against a service level.',
  jobs: [
    'Shows an estimator how much time is left against a service level, with a marker where the threshold sits.',
    'It never decides whether the service level is breached.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'current, threshold', type: 'number', required: true, meaning: 'The time used and the threshold, supplied by meaning. The marker reflects them.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation.' },
      { field: 'minimum, maximum', type: 'number', required: false, meaning: 'The ends of the scale.', freshness: 'As delivered.', whenAbsent: 'Zero and the supplied maximum.' },
      { field: 'textAlternative', type: 'text', required: true, meaning: 'The key figure in plain words, shown beside the chart.', freshness: 'As delivered.', whenAbsent: 'Not rendered: a chart without a text alternative is not allowed.' },
      { field: 'status', type: 'loading, ready or degraded', required: false, meaning: 'The condition of the data, supplied. An empty series shows the empty explanation. Never worked out.', freshness: 'As delivered.', whenAbsent: 'Ready.' },
      { field: 'emptyTitle, emptyExplanation', type: 'text', required: true, meaning: 'The words for the empty state: what is missing and what would fill it. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered without them.' },
    ],
  },
  governance: [
    { rule: 'It reflects the supplied values and never computes whether the SLA is breached.', source: 'BRD 1.2 5.9 (SLAIndicator, prohibited)' },
    { rule: 'The threshold is shown by a shape and a label as well as colour.', source: 'BRD 1.2 5.9 (SLAIndicator, prohibited); BRD 1.3 section 10.2' },
    { rule: 'Every visualization renders a supplied text alternative that states the key value beside the chart.', source: 'BRD 1.2 5.9.1 Feature 1A; BRD 1.3 section 10.5' },
    { rule: 'A visualization with no data explains why in plain words. It is never a blank chart.', source: 'BRD 1.2 5.9.1 Feature 5A; BRD 1.3 section 10.5' },
  ],
  dimensions: { data: ['ready', 'empty', 'degraded'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1; bar and marker 3:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'role=meter with min, max, now and a supplied text alternative; threshold has a visible label',
    reducedMotion: NA,
  },
  prohibited: ['compute-whether-sla-is-breached', 'color-alone-for-threshold', 'semantic-colors', 'derive-own-bounds'],
});
