import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'PasswordInput',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker type a password and check it before they sign in.',
  jobs: [
    'Lets the worker enter a password, with a button to show or hide it so a typing mistake is easy to spot.',
    'Used on sign in and sign up. It never stores or logs the password, and it never blocks pasting, so password managers work.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'text', required: true, meaning: 'The password as typed, held by the composing layer for the form only. This component never stores or logs it.', freshness: 'Not applicable: it is the worker\'s own entry.', whenAbsent: 'Shows an empty field.' },
      { field: 'autoComplete', type: 'current-password or new-password', required: true, meaning: 'Tells the browser whether this is an existing password or a new one, so a password manager can help.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the setting is required.' },
      { field: 'showLabel, hideLabel', type: 'text', required: true, meaning: 'The accessible names of the show and hide button, supplied.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the labels are required.' },
      { field: 'maxLength', type: 'whole number', required: false, meaning: 'The longest password allowed, supplied.', freshness: 'As delivered.', whenAbsent: 'No length limit is applied by the input.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'It never stores or logs the value, and visibility is presentation only: it resets when the field is shown again.', source: 'SECURITY.md (Secrets never kept)' },
    { rule: 'Pasting is never blocked, because blocking it defeats password managers and pushes workers toward weaker passwords.', source: 'SECURITY.md (Password manager and a11y friendly)' },
    { rule: 'Auto-capitalisation, auto-correction and spell-checking are always off, and the show and hide button reports its state with aria-pressed.', source: 'SECURITY.md (Password manager and a11y friendly)' },
    { rule: 'An input may enforce structural limits for immediate feedback, such as required, format and maximum length. It never decides business validity, eligibility or correctness: those results are supplied by the composing layer.', source: 'BRD 1.2 5.7.1 Feature 4A and 4B' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  outsideCatalogue: 'BRD 1.2 5.1.1 lists no password field. PasswordInput was added for sign in and sign up, which the BRDs describe only as SSO. It follows the rules in SECURITY.md and needs approval through library governance.',
  dimensions: { data: NA, interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['change'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px field and toggle',
    focus: 'visible keyboard focus ring',
    announcement: 'label via FormField, toggle uses aria-pressed and a supplied name',
    reducedMotion: NA,
  },
  prohibited: ['hold-value-as-authoritative', 'log-or-store-value', 'block-paste', 'placeholder-as-label'],
});
