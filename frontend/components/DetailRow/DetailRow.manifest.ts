import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'DetailRow',
  category: 'data-display',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows a worker one fact in a row, with its status beside it when there is one.',
  jobs: [
    'Shows a labelled value on one row, with an optional status on the end, such as a work order\'s site or customer.',
    'On tablet and desktop a row can sit beside others in two or three columns, and on a phone it stacks into one.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'text', required: true, meaning: 'The value of the field the label names, exactly as supplied.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Shows an empty value. No placeholder is invented.' },
      { field: 'status', type: 'label and tone', required: false, meaning: 'A status the canvas supplied about this row, shown by StatusPill. It is a reference to supplied data, not something worked out from the value.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'No status is shown. It is never derived from the value.' },
    ],
  },
  governance: [
    { rule: 'It renders supplied values and derives, computes or resolves nothing. No value, status or summary appears that was not in the supplied data.', source: 'BRD 1.2 5.6.1 Feature 1A; BRD 1.2 5.2 Feature 7B' },
    { rule: 'The trailing status is supplied and drawn by StatusPill or StatusIndicator. It is never derived from the value the row shows.', source: 'BRD 1.2 5.6.1 Feature 1B; BRD 1.2 5.6 (DetailRow, prohibited)' },
    { rule: 'It never owns a background. It sits on the Surface of its zone.', source: 'BRD 1.2 5.6 (DetailRow, prohibited); BRD 1.2 5.5.1 Feature 1A' },
    { rule: 'Several rows may share columns from tablet up and collapse to one column on mobile.', source: 'BRD 1.2 5.6 (DetailRow, purpose)' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: ['ready', 'empty'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'label then value; trailing status is visible text',
    reducedMotion: NA,
  },
  prohibited: ['derive-trailing-status', 'own-background', 'placeholder-for-absent-value'],
});
