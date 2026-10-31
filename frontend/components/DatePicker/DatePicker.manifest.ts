import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'DatePicker',
  category: 'input-control',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker choose a date at the site, without time zone surprises.',
  jobs: [
    'Lets the worker choose a date, such as a departure or a return date, using the device\'s own calendar.',
    'It only accepts real dates inside the limits it was given, and it never moves a date to another time zone.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'site-local date, YYYY-MM-DD, or none', required: true, meaning: 'The date the worker chose, as a calendar date at the site. It is never converted to the viewer\'s time zone.', freshness: 'Not applicable: it is the worker\'s own entry.', whenAbsent: 'Shows an empty field.' },
      { field: 'meaning', type: 'text', required: true, meaning: 'What this date means, named specifically, such as \'departure-date\' or \'valid-through\', never a generic \'date\'. Two dates with different meanings are never one field.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the meaning is required.' },
      { field: 'min', type: 'site-local date', required: false, meaning: 'The earliest date allowed, supplied. The picker enforces it and never works it out.', freshness: 'As delivered.', whenAbsent: 'No earliest limit.' },
      { field: 'max', type: 'site-local date', required: false, meaning: 'The latest date allowed, supplied. The picker enforces it and never works it out.', freshness: 'As delivered.', whenAbsent: 'No latest limit.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'The field is named by the specific meaning of its date, not a generic date, and two dates with different meanings are never collapsed into one field.', source: 'BRD 1.2 5.7.1 Feature 5A; BRD 1.2 5.3 Feature 2A and 2B' },
    { rule: 'It enforces only the bounds it was given and never derives its own.', source: 'BRD 1.2 5.7.1 Feature 6A' },
    { rule: 'It reports only a real calendar date inside the bounds, or none when cleared. Anything else is ignored.', source: 'BRD 1.2 5.7 (DatePicker, events)' },
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: NA, interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['change', 'focus', 'blur'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px minimum',
    focus: 'visible keyboard focus ring; native keyboard operation',
    announcement: 'native date control with a visible label via FormField, aria-invalid and aria-describedby',
    reducedMotion: NA,
  },
  prohibited: ['derive-own-bounds', 'name-field-generically', 'hold-value-as-authoritative', 'convert-site-local-date-to-viewer-time-zone', 'emit-impossible-or-out-of-bounds-date'],
});
