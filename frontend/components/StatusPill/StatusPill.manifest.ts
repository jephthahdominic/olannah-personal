import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'StatusPill',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker the status of a record in a word, such as approved or late.',
  jobs: [
    'Shows a worker the status of a record in a word, such as approved, late or needs review. It sits beside the record it describes.',
    'The status is supplied. The pill never works it out from other data.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'label', type: 'text', required: true, meaning: 'The status in the words the source record uses, shown as supplied.', freshness: 'As delivered.', whenAbsent: 'Nothing is shown. A pill with no label is not rendered.' },
      { field: 'tone', type: 'success, warning, error, checkpoint or neutral', required: true, meaning: 'The meaning the status carries, so it takes its semantic colour and shape. Supplied with the label, never worked out.', freshness: 'As delivered.', whenAbsent: 'Neutral tone is not assumed. The pill is not rendered without a tone.' },
    ],
  },
  governance: [
    { rule: 'It renders a status the canvas supplied and never derives it from other data.', source: 'BRD 1.2 5.8 (StatusPill, prohibited); BRD 1.2 5.8.1 Feature 3A' },
    { rule: 'Meaning is never carried by colour alone. A shape and the visible label always accompany it.', source: 'BRD 1.2 5.8.1 Feature 4A; BRD 1.3 sections 9.4 and 11.1' },
    { rule: 'A colour outside its semantic token is never used.', source: 'BRD 1.2 5.8 (StatusPill, prohibited); BRD 1.3 section 3.3' },
  ],
  dimensions: { data: ['ready', 'empty'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1 on tint',
    touchTarget: NA,
    focus: NA,
    announcement: 'visible text',
    reducedMotion: NA,
  },
  prohibited: ['derive-status', 'meaning-by-color-alone'],
});
