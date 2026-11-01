import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'ChoiceGroup',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker pick one answer from a short list that stays visible, such as a time type.',
  jobs: [
    'Lets the worker pick exactly one answer from a short list laid out as large radio rows, such as a time type or a yes-or-no hazard question.',
    'Every row is big enough to tap with a glove on. It never decides which answers are valid.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'options', type: 'list of value, label, description and disabled', required: true, meaning: 'The answers on offer, in the order supplied. The component never hardcodes options or decides which are valid.', freshness: 'As delivered.', whenAbsent: 'Shows the supplied empty title and explanation. It is never blank.' },
      { field: 'selection', type: 'text or none', required: true, meaning: 'Which answer is chosen, as the composing layer holds it.', freshness: 'Not applicable: it is the worker\'s own choice.', whenAbsent: 'Nothing is selected.' },
      { field: 'legend', type: 'text', required: true, meaning: 'The visible name of the group, read out as the group\'s name. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the legend is required.' },
      { field: 'emptyTitle, emptyExplanation', type: 'text', required: true, meaning: 'The words shown when there are no options. Supplied.', freshness: 'As delivered.', whenAbsent: 'These are the content of the empty state.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'It never hardcodes options or decides which are valid. Filtering for usability is allowed, deciding validity is not.', source: 'BRD 1.2 5.7.1 Feature 2C' },
    { rule: 'The group has a visible label, exposed as the radio group\'s name.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'Every option row meets the 44 pixel touch target at every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: ['ready', 'empty'], interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['change', 'focus', 'blur'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px option rows',
    focus: 'visible keyboard focus ring on the row; arrow keys move between options',
    announcement: 'radio group with a visible legend',
    reducedMotion: NA,
  },
  prohibited: ['hardcode-options', 'decide-validity-or-billability', 'hold-selection-as-authoritative', 'selection-by-color-alone'],
});
