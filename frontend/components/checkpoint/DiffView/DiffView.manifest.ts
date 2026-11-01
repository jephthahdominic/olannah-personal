import { defineComponent, NA } from '../../manifest';

export const manifest = defineComponent({
  name: 'DiffView',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows a worker exactly what will be written, current against proposed, so they know what they approve.',
  jobs: [
    'Shows a worker exactly what will be written, the current value against the proposed one, so they know what they are approving.',
    'It is read-only and does not change after it first appears.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'diff', type: 'target system, record identifier, originating agent and a current and proposed value for each field', required: true, meaning: 'The change to be written, supplied by the canvas and shown exactly. Never transformed.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'labels', type: 'text for each heading', required: true, meaning: 'The words for the headings. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
    ],
  },
  governance: [
    { rule: 'It renders the supplied diff exactly and accepts no input.', source: 'BRD 1.2 5.10.1 Feature 1A; BRD 1.2 5.10 (DiffView, prohibited)' },
    { rule: 'Its content does not change after its first render for the life of the checkpoint. A change upstream cancels and reissues.', source: 'BRD 1.2 5.10.1 Feature 1A; BRD 1.4 sections 2E and 2F' },
    { rule: 'It never edits, transforms or derives a value.', source: 'BRD 1.2 5.10 (DiffView, prohibited)' },
  ],
  gaps: [
    'BRD 1.4 was not provided. The 500ms render target is named in BRD 1.2 section 6.',
  ],
  dimensions: { data: ['ready'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1 on Sage Mist',
    touchTarget: NA,
    focus: NA,
    announcement: 'labelled section; each field reads its name, then Now, then Will be',
    reducedMotion: NA,
  },
  prohibited: ['accept-input', 'edit-the-proposed-write', 'transform-or-derive-any-value', 'change-after-initial-render', 'change-communicated-by-color-alone'],
});
