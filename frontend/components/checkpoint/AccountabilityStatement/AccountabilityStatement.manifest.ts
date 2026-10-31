import { defineComponent, NA } from '../../manifest';

export const manifest = defineComponent({
  name: 'AccountabilityStatement',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker, in the same words every time, what they are confirming.',
  jobs: [
    'Tells a worker, in the same words every time, what they are confirming when they approve a change.',
    'It sits above the decision controls in plain sight.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'statement', type: 'text', required: true, meaning: 'What the worker is confirming. Supplied; identical for every persona and source system.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'heading', type: 'text', required: false, meaning: 'An optional heading above the statement.', freshness: 'As delivered.', whenAbsent: 'No heading.' },
    ],
  },
  governance: [
    { rule: 'It renders identically across all personas, workflows and target systems.', source: 'BRD 1.2 5.10.1 Feature 4A; BRD 1.2 5.10 (AccountabilityStatement, prohibited)' },
    { rule: 'It sits above the decision controls in primary hierarchy, never as a footnote, tooltip or secondary element.', source: 'BRD 1.2 5.10.1 Feature 4A' },
  ],
  dimensions: { data: ['ready'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1 on the checkpoint tint',
    touchTarget: NA,
    focus: NA,
    announcement: 'plain text in reading order',
    reducedMotion: NA,
  },
  prohibited: ['vary-by-persona-workflow-or-system', 'render-as-footnote-tooltip-or-secondary'],
});
