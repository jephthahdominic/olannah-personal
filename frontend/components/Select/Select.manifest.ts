import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Select',
  category: 'input-control',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker pick one option from a list when the choices are many.',
  jobs: [
    'Lets the worker choose one option from a list the canvas supplied, such as a failure condition.',
    'It uses the phone\'s own picker or the desktop\'s own list, so it behaves the way the worker already knows. It never decides which options are valid.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'options', type: 'list of value, label and disabled', required: true, meaning: 'The choices on offer, in the order supplied. The option set is the source system\'s business, not the component\'s.', freshness: 'As delivered.', whenAbsent: 'Shows the supplied \'nothing to choose\' text and disables the control. It is never blank.' },
      { field: 'selection', type: 'text or none', required: true, meaning: 'Which option is chosen, as the composing layer holds it. None means nothing is chosen yet.', freshness: 'Not applicable: it is the worker\'s own choice.', whenAbsent: 'Shows the supplied placeholder as a disabled first option.' },
      { field: 'placeholder', type: 'text', required: true, meaning: 'The words for the unchosen state, such as \'Choose a failure condition\'. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the text is required.' },
      { field: 'emptyLabel', type: 'text', required: true, meaning: 'The words shown instead of an empty list. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the text is required.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'It fetches nothing. What it shows is supplied by the canvas.', source: 'BRD 1.2 5.7.1 Feature 2A' },
    { rule: 'It never alters the authoritative option set based on business rules. Filtering for usability is allowed. Deciding what is valid is not.', source: 'BRD 1.2 5.7.1 Feature 2C' },
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: ['ready', 'empty'], interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['change', 'focus', 'blur'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px minimum',
    focus: 'visible keyboard focus ring; native keyboard operation',
    announcement: 'native select with a visible label via FormField, aria-invalid and aria-describedby',
    reducedMotion: NA,
  },
  prohibited: ['fetch-options', 'alter-option-set-by-business-rule', 'hold-selection-as-authoritative', 'placeholder-as-label'],
});
