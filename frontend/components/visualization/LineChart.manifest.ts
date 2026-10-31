import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'LineChart',
  category: 'visualization',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets an estimator see how a figure changed over a period.',
  jobs: [
    'Lets an estimator see how a figure changed over a period, such as consumption or SLA across the month.',
    'It draws the points it is given and never adds a trend line of its own.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'series', type: 'list of up to five named series with values', required: true, meaning: 'The data to plot, supplied. Each series has a name.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation.' },
      { field: 'xLabels', type: 'list of text', required: true, meaning: 'The labels along the time axis. A site-local date is formatted, never converted.', freshness: 'As delivered.', whenAbsent: 'Shows the empty explanation.' },
      { field: 'textAlternative', type: 'text', required: true, meaning: 'The key figure in plain words, shown beside the chart.', freshness: 'As delivered.', whenAbsent: 'Not rendered: a chart without a text alternative is not allowed.' },
      { field: 'status', type: 'loading, ready or degraded', required: false, meaning: 'The condition of the data, supplied. An empty series shows the empty explanation. Never worked out.', freshness: 'As delivered.', whenAbsent: 'Ready.' },
      { field: 'emptyTitle, emptyExplanation', type: 'text', required: true, meaning: 'The words for the empty state: what is missing and what would fill it. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered without them.' },
    ],
  },
  governance: [
    { rule: 'No chart shows more than five series. More than five is presented as a table. viz-3 and viz-5 are never adjacent.', source: 'BRD 1.2 5.9.1 Features 2A and 3A; BRD 1.3 sections 10.2 and 10.5' },
    { rule: 'Series and segments are told apart without colour, by pattern or label.', source: 'BRD 1.2 5.9.1 Feature 2A; BRD 1.3 section 10.2' },
    { rule: 'It never derives a trend line the data does not carry.', source: 'BRD 1.2 5.9 (LineChart, prohibited)' },
    { rule: 'Every visualization renders a supplied text alternative that states the key value beside the chart.', source: 'BRD 1.2 5.9.1 Feature 1A; BRD 1.3 section 10.5' },
    { rule: 'A visualization with no data explains why in plain words. It is never a blank chart.', source: 'BRD 1.2 5.9.1 Feature 5A; BRD 1.3 section 10.5' },
  ],
  dimensions: { data: ['loading', 'ready', 'empty', 'degraded'], interaction: ['default', 'focus'], runtime: NA },
  events: ['point-select'],
  a11y: {
    contrast: 'axis and labels 4.5:1; lines 3:1',
    touchTarget: '44px point markers when interactive',
    focus: 'visible keyboard focus ring on point markers',
    announcement: 'figure with a visible text alternative and a visually hidden data table of exact values',
    reducedMotion: NA,
  },
  prohibited: ['more-than-five-series', 'derive-trend-line', 'bridge-missing-values', 'render-without-text-alternative', 'semantic-colors', 'color-alone-differentiation', 'convert-site-local-dates'],
});
