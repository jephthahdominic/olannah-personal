import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'NumberInput',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker enter a quantity, with limits they can see.',
  jobs: [
    'Lets the worker enter a quantity, with a number keypad on a phone and optional plus and minus buttons.',
    'It keeps the number inside the limits it was given. It never adds anything up and never checks a price or a rule.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'number or none', required: true, meaning: 'The quantity the worker entered, as the composing layer holds it. The field\'s label names what it counts.', freshness: 'Not applicable: it is the worker\'s own entry.', whenAbsent: 'Shows an empty field.' },
      { field: 'minimum', type: 'number', required: false, meaning: 'The smallest value allowed, supplied. The input enforces it and never works it out.', freshness: 'As delivered.', whenAbsent: 'No lower limit.' },
      { field: 'maximum', type: 'number', required: false, meaning: 'The largest value allowed, supplied. The input enforces it and never works it out.', freshness: 'As delivered.', whenAbsent: 'No upper limit.' },
      { field: 'step', type: 'number', required: false, meaning: 'How much each plus or minus changes the value, supplied.', freshness: 'As delivered.', whenAbsent: 'One.' },
      { field: 'steppers', type: 'decrementLabel and incrementLabel', required: false, meaning: 'The accessible names of the plus and minus buttons. Supplied. The buttons are shown only when these are given.', freshness: 'As delivered.', whenAbsent: 'No plus and minus buttons.' },
      { field: 'decimal', type: 'true or false', required: false, meaning: 'Whether a decimal keypad is wanted.', freshness: 'As delivered.', whenAbsent: 'Whole numbers.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'It enforces only the bounds and step it was given and never derives its own.', source: 'BRD 1.2 5.7.1 Feature 6A' },
    { rule: 'It emits a value only when it is within the bounds, and settles an out-of-range entry to the nearest bound when the worker leaves the field.', source: 'BRD 1.2 5.7.1 Feature 4A' },
    { rule: 'It calculates no totals and checks no pricing or business rules.', source: 'BRD 1.2 5.7.1 Feature 4B' },
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: NA, interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['change', 'focus', 'blur'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px field and steppers',
    focus: 'visible keyboard focus ring',
    announcement: 'label via FormField; steppers carry supplied names',
    reducedMotion: NA,
  },
  prohibited: ['calculate-totals', 'validate-pricing-rules', 'persist-order', 'derive-own-bounds-or-step', 'hold-value-as-authoritative'],
});
