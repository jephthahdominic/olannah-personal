import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'TextArea',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker write a longer note.',
  jobs: [
    'Lets the worker write longer, free text over several lines, such as a note or feedback.',
    'Like TextInput it keeps nothing itself: the composing layer holds the text and its draft.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'text', required: true, meaning: 'What the worker has written, as the composing layer holds it. The label names what it is.', freshness: 'Not applicable: it is the worker\'s own entry.', whenAbsent: 'Shows an empty field.' },
      { field: 'maxLength', type: 'whole number', required: false, meaning: 'The longest entry allowed, supplied. A structural limit.', freshness: 'As delivered.', whenAbsent: 'No length limit is applied by the input.' },
      { field: 'rows', type: 'whole number', required: false, meaning: 'How many lines tall the field starts, a presentation choice.', freshness: 'As delivered.', whenAbsent: 'Four lines.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'An input may enforce structural limits for immediate feedback, such as required, format and maximum length. It never decides business validity, eligibility or correctness: those results are supplied by the composing layer.', source: 'BRD 1.2 5.7.1 Feature 4A and 4B' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  outsideCatalogue: 'BRD 1.2 5.1.1 lists TextInput but no multi-line field. TextArea was added for the feedback form and notes. It binds the same rules as TextInput and needs approval through library governance.',
  dimensions: { data: NA, interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['change'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px minimum',
    focus: 'visible keyboard focus ring',
    announcement: 'label via FormField, aria-invalid and aria-describedby',
    reducedMotion: NA,
  },
  prohibited: ['hold-value-as-authoritative', 'write-anywhere', 'placeholder-as-label', 'decide-business-validity'],
});
