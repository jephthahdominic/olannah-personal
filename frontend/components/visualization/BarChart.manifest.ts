import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'BarChart',
  category: 'visualization',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets an estimator compare a few categories side by side.',
  jobs: [
    'Lets an estimator compare a few categories side by side, such as spend by supplier.',
    'Each bar series is told apart by pattern as well as colour, and a text summary sits beside it.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'series', type: 'list of up to five named series with values', required: true, meaning: 'The data to compare, supplied. Each series has a name. Missing values are shown as gaps.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation.' },
      { field: 'categories', type: 'list of text', required: true, meaning: 'The category names along the axis.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation.' },
      { field: 'textAlternative', type: 'text', required: true, meaning: 'The key figure in plain words, shown beside the chart.', freshness: 'As delivered.', whenAbsent: 'Not rendered: a chart without a text alternative is not allowed.' },
      { field: 'status', type: 'loading, ready or degraded', required: false, meaning: 'The condition of the data, supplied. An empty series shows the empty explanation. Never worked out.', freshness: 'As delivered.', whenAbsent: 'Ready.' },
      { field: 'emptyTitle, emptyExplanation', type: 'text', required: true, meaning: 'The words for the empty state: what is missing and what would fill it. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered without them.' },
    ],
  },
  governance: [
    { rule: 'No chart shows more than five series. More than five is presented as a table. viz-3 and viz-5 are never adjacent.', source: 'BRD 1.2 5.9.1 Features 2A and 3A; BRD 1.3 sections 10.2 and 10.5' },
    { rule: 'Series and segments are told apart without colour, by pattern or label.', source: 'BRD 1.2 5.9.1 Feature 2A; BRD 1.3 section 10.2' },
    { rule: 'Every visualization renders a supplied text alternative that states the key value beside the chart.', source: 'BRD 1.2 5.9.1 Feature 1A; BRD 1.3 section 10.5' },
    { rule: 'A visualization with no data explains why in plain words. It is never a blank chart.', source: 'BRD 1.2 5.9.1 Feature 5A; BRD 1.3 section 10.5' },
    { rule: 'It selects a series on hover or focus and emits series-select. It never derives a value.', source: 'BRD 1.2 5.9 (BarChart, events)' },
  ],
  dimensions: { data: ['loading', 'ready', 'empty', 'degraded'], interaction: ['default', 'focus'], runtime: NA },
  events: ['series-select'],
  a11y: {
    contrast: 'axis and labels 4.5:1; bars 3:1',
    touchTarget: '44px legend items',
    focus: 'visible keyboard focus ring on legend items',
    announcement: 'figure with a visible text alternative and a visually hidden data table of exact values',
    reducedMotion: NA,
  },
  prohibited: ['more-than-five-series', 'viz-3-and-viz-5-adjacent', 'render-without-text-alternative', 'semantic-colors', 'color-alone-differentiation', 'render-blank-when-empty', 'treat-missing-as-zero'],
});
