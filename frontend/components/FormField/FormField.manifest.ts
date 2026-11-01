import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'FormField',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Wraps a control with its name, hint and error, so a worker always knows what is being asked.',
  jobs: [
    'Gives a control its visible label, optional help text and a validation message, and ties them to the control so a screen reader reads them together.',
    'Every input sits in one. It shows a validation message that was supplied, with a shape as well as words, and never works out whether an entry is valid.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'label', type: 'text', required: true, meaning: 'The visible name of the field. It stays visible when the field holds a value.', freshness: 'As delivered. The component shows no age.', whenAbsent: 'Not accepted: every field needs a label.' },
      { field: 'validationMessage', type: 'text', required: false, meaning: 'Why the entry is not acceptable, in plain words. Supplied by the composing layer. The wrapper does not compute business validity and never builds this text from a code.', freshness: 'As delivered. The component shows no age.', whenAbsent: 'No message is shown.' },
      { field: 'helpText', type: 'text', required: false, meaning: 'A short hint about what to enter, supplied.', freshness: 'As delivered. The component shows no age.', whenAbsent: 'No hint is shown.' },
      { field: 'control', type: 'a form control', required: true, meaning: 'The control being wrapped. It owns its own value and events.', freshness: 'Not applicable.', whenAbsent: 'Not accepted: a field needs a control.' },
    ],
  },
  governance: [
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'It renders a supplied validation message and never computes business validity itself.', source: 'BRD 1.2 5.7 (FormField, purpose and prohibited)' },
    { rule: 'It never uses a placeholder in place of the visible label, and never owns the control\'s value.', source: 'BRD 1.2 5.7 (FormField, prohibited)' },
    { rule: 'A problem is shown with a shape and words, never colour alone.', source: 'BRD 1.0 section 6 (Visual Treatment Rules)' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: NA, interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: NA,
    focus: 'inherited from control',
    announcement: 'visible label associated by id',
    reducedMotion: NA,
  },
  prohibited: ['compute-business-validity', 'placeholder-as-label', 'own-control-value'],
});
