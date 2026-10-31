import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'FeedbackForm',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker report a problem in one step, with the screen they are on captured for them.',
  jobs: [
    'Lets a worker report a problem in one step, with the screen they are on captured for them.',
    'It never decides whether the report was sent.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'screenSummary', type: 'text', required: true, meaning: 'The current screen and view, captured automatically and supplied. The worker never describes it.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'draft', type: 'text', required: true, meaning: 'What the worker wrote. The composing layer owns it.', freshness: 'As delivered.', whenAbsent: 'Empty.' },
      { field: 'status', type: 'idle, submitting, succeeded or failed', required: true, meaning: 'The submission state, supplied. The form never concludes success or failure itself.', freshness: 'As delivered.', whenAbsent: 'Idle.' },
      { field: 'open', type: 'true or false', required: true, meaning: 'Whether the form is open. The composing layer owns it.', freshness: 'As delivered.', whenAbsent: 'Closed.' },
    ],
  },
  governance: [
    { rule: 'It captures the screen and view automatically. The worker never describes where they are.', source: 'BRD 1.2 5.10.1 Feature 7A; BRD 1.3 section 14' },
    { rule: 'It shows the supplied submission state and never decides success or failure.', source: 'BRD 1.2 5.10.1 Feature 7A; BRD 1.2 5.10 (FeedbackForm, prohibited)' },
    { rule: 'It never holds the draft as authoritative.', source: 'BRD 1.2 5.10 (FeedbackForm, prohibited)' },
  ],
  dimensions: { data: NA, interaction: ['default', 'focus', 'processing'], runtime: NA },
  events: ['submit', 'dismiss'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px controls',
    focus: 'trapped while open, Escape closes, focus returns to the opener',
    announcement: 'role=dialog; submission failure is role=alert; success is role=status',
    reducedMotion: 'transitions replaced by 150ms fade',
  },
  prohibited: ['hold-draft-as-authoritative', 'decide-submission-success', 'require-manual-screen-description', 'capture-screenshot'],
});
