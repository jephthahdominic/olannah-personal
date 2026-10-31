import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'InlineError',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker something failed, in plain words, and what they can do next.',
  jobs: [
    'Tells a worker that something failed, in plain words, right where it happened, and what they can do about it.',
    'It never shows a code, a service name or a stack trace.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'title', type: 'text', required: true, meaning: 'What went wrong, in the worker\'s words. Supplied; resolved upstream from the source error.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'body', type: 'text', required: false, meaning: 'What the worker can do next. Supplied.', freshness: 'As delivered.', whenAbsent: 'Only the title is shown.' },
      { field: 'tone', type: 'failure or degraded', required: false, meaning: 'Whether this is a failure or a limited service. Failure by default.', freshness: 'As delivered.', whenAbsent: 'Failure.' },
    ],
  },
  governance: [
    { rule: 'It renders a supplied meaning and suggested action and never maps a code to either.', source: 'BRD 1.2 5.8.1 Feature 2A; BRD 1.2 5.8 (InlineError, prohibited)' },
    { rule: 'A failure surface offers a recovery action where one exists, or says plainly that none exists.', source: 'BRD 1.2 5.8.1 Feature 2B; BRD 1.3 section 7.4' },
    { rule: 'It never shows stack traces, raw error codes, service names or technical identifiers.', source: 'BRD 1.2 5.8.1 Feature 5A' },
    { rule: 'Colour is never the only carrier of the condition.', source: 'BRD 1.2 5.8.1 Feature 4A' },
  ],
  dimensions: { data: ['ready'], interaction: ['default', 'focus'], runtime: NA },
  events: ['retry', 'dismiss'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px actions',
    focus: 'visible keyboard focus ring',
    announcement: 'role=alert for failure, role=status for degraded',
    reducedMotion: NA,
  },
  prohibited: ['map-code-to-message', 'expose-internal-codes', 'color-alone'],
});
