import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'ProgressRing',
  category: 'visualization',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows an estimator how much of a whole is complete, with the figure in the centre.',
  jobs: [
    'Shows an estimator how much of a whole is complete, such as a quote\'s completeness or a capacity, with the figure in the centre.',
    'It draws the ratio. It never says whether the figure is good or bad.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'number', required: true, meaning: 'The part completed, supplied.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation.' },
      { field: 'total', type: 'number', required: true, meaning: 'The whole the part is measured against, supplied.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation when it is not above zero.' },
      { field: 'textAlternative', type: 'text', required: true, meaning: 'The key figure in plain words, shown beside the chart.', freshness: 'As delivered.', whenAbsent: 'Not rendered: a chart without a text alternative is not allowed.' },
      { field: 'emptyExplanation', type: 'text', required: true, meaning: 'Why there is no figure. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered without it.' },
    ],
  },
  governance: [
    { rule: 'It always shows the exact value as a centred text label.', source: 'BRD 1.2 5.9.1 Feature 4A; BRD 1.3 section 10.5' },
    { rule: 'Every visualization renders a supplied text alternative that states the key value beside the chart.', source: 'BRD 1.2 5.9.1 Feature 1A; BRD 1.3 section 10.5' },
    { rule: 'A visualization with no data explains why in plain words. It is never a blank chart.', source: 'BRD 1.2 5.9.1 Feature 5A; BRD 1.3 section 10.5' },
    { rule: 'It implies no status the data does not carry.', source: 'BRD 1.2 5.9 (ProgressRing, prohibited)' },
  ],
  dimensions: { data: ['ready', 'empty'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'centred label 4.5:1; ring 3:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'role=img with a supplied text alternative; the centred figure is visible text',
    reducedMotion: NA,
  },
  prohibited: ['render-without-centred-value', 'imply-a-status-the-data-does-not-carry', 'semantic-colors', 'render-blank-when-empty'],
});
