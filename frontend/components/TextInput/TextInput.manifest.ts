import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'TextInput',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker type a short answer, such as a note or a search.',
  jobs: [
    'Lets the worker type a short piece of text, such as a name, an email or a reference.',
    'It is always used inside a FormField so it has a visible label. It reports each change to the canvas and keeps nothing itself.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'text', required: true, meaning: 'What the worker has typed, as the composing layer holds it. The specific meaning (for example \'email address\' or \'site name\') is named by the field\'s label, not by the input.', freshness: 'Not applicable: it is the worker\'s own entry.', whenAbsent: 'Shows an empty field.' },
      { field: 'maxLength', type: 'whole number', required: false, meaning: 'The longest entry allowed, supplied. A structural limit, not a business rule.', freshness: 'As delivered.', whenAbsent: 'No length limit is applied by the input.' },
      { field: 'required, type, inputMode, autoComplete', type: 'settings', required: false, meaning: 'Structural settings for capture, such as whether the field must be filled and which keyboard a phone shows.', freshness: 'As delivered.', whenAbsent: 'Treated as not required, plain text, default keyboard.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'An input may enforce structural limits for immediate feedback, such as required, format and maximum length. It never decides business validity, eligibility or correctness: those results are supplied by the composing layer.', source: 'BRD 1.2 5.7.1 Feature 4A and 4B' },
    { rule: 'Identifiers and passwords can be marked hardened, which turns off auto-capitalisation, auto-correction and spell-checking, so the value is never changed or sent to a dictionary.', source: 'SECURITY.md (Password manager and a11y friendly)' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  gaps: [
    'BRD 1.2 5.7 lists three events for TextInput: change, focus and blur. This component emits change only.',
  ],
  dimensions: { data: NA, interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['change'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px minimum',
    focus: 'visible keyboard focus ring',
    announcement: 'label via FormField, aria-invalid and aria-describedby',
    reducedMotion: NA,
  },
  prohibited: ['hold-value-as-authoritative', 'write-anywhere', 'placeholder-as-label'],
});
