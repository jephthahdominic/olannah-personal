import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'DonutChart',
  category: 'visualization',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows an estimator how a total is split, with the main figure in the centre.',
  jobs: [
    'Shows an estimator how a total is split, such as the status of packets, with the main figure in the centre.',
    'Segments are told apart by pattern and label as well as colour.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'segments', type: 'list of named segments with values', required: true, meaning: 'The parts of the whole, supplied.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation.' },
      { field: 'centerValue', type: 'text', required: true, meaning: 'The primary figure shown in the centre, supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered: a donut without its centred value is not allowed.' },
      { field: 'textAlternative', type: 'text', required: true, meaning: 'The key figure in plain words, shown beside the chart.', freshness: 'As delivered.', whenAbsent: 'Not rendered: a chart without a text alternative is not allowed.' },
      { field: 'status', type: 'loading, ready or degraded', required: false, meaning: 'The condition of the data, supplied. An empty series shows the empty explanation. Never worked out.', freshness: 'As delivered.', whenAbsent: 'Ready.' },
      { field: 'emptyTitle, emptyExplanation', type: 'text', required: true, meaning: 'The words for the empty state: what is missing and what would fill it. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered without them.' },
    ],
  },
  governance: [
    { rule: 'It always shows the supplied centred value as text.', source: 'BRD 1.2 5.9.1 Feature 4A; BRD 1.3 section 10.5' },
    { rule: 'No donut shows more than five segments.', source: 'BRD 1.2 5.9 (DonutChart, prohibited); BRD 1.2 5.9.1 Feature 3A' },
    { rule: 'Series and segments are told apart without colour, by pattern or label.', source: 'BRD 1.2 5.9.1 Feature 2A; BRD 1.3 section 10.2' },
    { rule: 'Every visualization renders a supplied text alternative that states the key value beside the chart.', source: 'BRD 1.2 5.9.1 Feature 1A; BRD 1.3 section 10.5' },
    { rule: 'A visualization with no data explains why in plain words. It is never a blank chart.', source: 'BRD 1.2 5.9.1 Feature 5A; BRD 1.3 section 10.5' },
  ],
  dimensions: { data: ['loading', 'ready', 'empty', 'degraded'], interaction: ['default', 'focus'], runtime: NA },
  events: ['segment-select'],
  a11y: {
    contrast: 'centred value 4.5:1; segments 3:1',
    touchTarget: '44px legend items',
    focus: 'visible keyboard focus ring on legend items and segments',
    announcement: 'role=img with a supplied text alternative, a legend with exact values, and a visible text alternative',
    reducedMotion: NA,
  },
  prohibited: ['render-without-centred-value', 'more-than-five-segments', 'color-alone-differentiation', 'semantic-colors', 'render-without-text-alternative'],
});
