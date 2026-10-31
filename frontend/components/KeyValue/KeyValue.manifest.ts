import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'KeyValue',
  category: 'data-display',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows a worker one fact about the job, such as a site address, with its name beside it.',
  jobs: [
    'Shows one fact under its name, such as a customer or a scheduled time, exactly as the canvas supplied it.',
    'It is the smallest unit of information on screen. Rows, cards and the work order are made of it.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'text', required: true, meaning: 'The value of the field the label names, exactly as supplied. The composing layer names the specific meaning (for example \'Customer\' or \'Scheduled start\') through the label. The component never reformats it into another meaning.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Shows an empty value under its label. No placeholder is invented (BRD 1.2 5.6, KeyValue).' },
    ],
  },
  governance: [
    { rule: 'It renders supplied values and derives, computes or resolves nothing. No value, status or summary appears that was not in the supplied data.', source: 'BRD 1.2 5.6.1 Feature 1A; BRD 1.2 5.2 Feature 7B' },
    { rule: 'It never reformats a value into a different meaning, and shows no placeholder when the value is absent.', source: 'BRD 1.2 5.6 (KeyValue, prohibited)' },
    { rule: 'A required value that is absent shows the empty state with supplied content, never a blank or invented one.', source: 'BRD 1.2 5.6.1 Feature 5A' },
    { rule: 'The label is presentation, not a data field. It may be changed for terminology, but never changes what the value is.', source: 'BRD 1.2 5.2 Feature 7A' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: ['ready', 'empty'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'label then value',
    reducedMotion: NA,
  },
  prohibited: ['reformat-value-into-other-meaning', 'placeholder-for-absent-value'],
});
