import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'EmptyState',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker why there is nothing here and what would make something appear.',
  jobs: [
    'Tells a worker why there is nothing here and what would make something appear, so an empty area never looks broken.',
    'It can offer one action.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'title', type: 'text', required: true, meaning: 'A short statement that nothing is here. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'explanation', type: 'text', required: true, meaning: 'Why it is empty and what would cause data to appear. Supplied; never blank, never invented.', freshness: 'As delivered.', whenAbsent: 'Not rendered: an empty state with no explanation is not allowed.' },
    ],
  },
  governance: [
    { rule: 'It always explains why the area is empty. It is never blank.', source: 'BRD 1.2 5.8 (EmptyState, prohibited)' },
    { rule: 'The explanation is supplied. The component never invents one or works out why data is absent.', source: 'BRD 1.2 5.8 (EmptyState, prohibited); BRD 1.2 5.2 Feature 7' },
    { rule: 'Empty means data resolved and nothing exists. It is not the same as loading or an error.', source: 'BRD 1.2 5.8 (conditions table)' },
  ],
  dimensions: { data: ['ready'], interaction: ['default', 'focus'], runtime: NA },
  events: ['action'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px action',
    focus: 'visible keyboard focus ring',
    announcement: 'plain text explanation',
    reducedMotion: NA,
  },
  prohibited: ['render-blank', 'invent-explanation', 'error-or-warning-token'],
});
