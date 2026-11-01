import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Toast',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Briefly confirms to a worker that something they did has happened, then goes away.',
  jobs: [
    'Briefly confirms to a worker that something they did has happened, such as a note being saved, and then goes away by itself.',
    'It never blocks the screen and never covers a decision.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'message', type: 'text', required: true, meaning: 'What happened, in plain words. Supplied; never generated from a code.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'tone', type: 'success or info', required: false, meaning: 'The kind of message. Info by default.', freshness: 'As delivered.', whenAbsent: 'Info.' },
      { field: 'durationMs', type: 'number of milliseconds', required: false, meaning: 'How long the toast stays. Seven seconds by default.', freshness: 'As delivered.', whenAbsent: 'Seven seconds.' },
    ],
  },
  governance: [
    { rule: 'It renders only in reserved regions outside the checkpoint area and never covers checkpoint content or decision controls.', source: 'BRD 1.2 5.8.1 Feature 7A; BRD 1.3 section 7.3' },
    { rule: 'It leaves by itself after seven seconds unless the worker dismisses it sooner.', source: 'BRD 1.2 5.8.1 Feature 8A' },
    { rule: 'The timer pauses while the toast is hovered or focused and resumes when the pointer or focus leaves.', source: 'BRD 1.2 5.8.1 Feature 8B' },
    { rule: 'Its message is supplied. It never generates a message from a code.', source: 'BRD 1.2 5.8 (Toast, prohibited)' },
  ],
  dimensions: { data: NA, interaction: ['default', 'focus'], runtime: NA },
  events: ['dismiss'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px dismiss',
    focus: 'timer pauses on focus and hover',
    announcement: 'role=status',
    reducedMotion: NA,
  },
  prohibited: ['generate-message-from-code', 'block-interaction', 'persist-beyond-duration', 'obscure-checkpoint'],
});
