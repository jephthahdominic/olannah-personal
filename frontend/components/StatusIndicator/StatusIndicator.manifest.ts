import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'StatusIndicator',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker a condition at a glance with a shape and colour, never colour alone.',
  jobs: [
    'Tells a worker a condition at a glance with a shape and a colour together: success, warning, error, checkpoint, inactive or loading.',
    'It is the small marker that sits beside text, so the condition is clear even when the colour is not.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'state', type: 'success, warning, error, checkpoint, inactive or loading', required: true, meaning: 'The condition, supplied. Each state carries its own shape and its own semantic token from the design system.', freshness: 'As delivered.', whenAbsent: 'Nothing is shown.' },
      { field: 'label', type: 'text', required: true, meaning: 'The plain-language name of the condition for assistive technology.', freshness: 'As delivered.', whenAbsent: 'Not accepted: a marker with no label is not rendered, unless it is marked decorative beside visible text.' },
    ],
  },
  governance: [
    { rule: 'It renders the supplied state and never computes it. Each state keeps its design-system shape; no shape is substituted.', source: 'BRD 1.2 5.8 (StatusIndicator, prohibited); BRD 1.3 section 9.4' },
    { rule: 'Success is a circle, warning a triangle, error a circle with a cross, and checkpoint an outline rather than a fill.', source: 'BRD 1.3 section 9.4' },
    { rule: 'Colour is never the only carrier of the state. A shape and an accessible label always accompany it.', source: 'BRD 1.2 5.8.1 Feature 4A' },
  ],
  dimensions: { data: ['ready'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'shape 3:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'role=img with supplied label, or aria-hidden when decorative',
    reducedMotion: 'loading ring stops',
  },
  prohibited: ['compute-state', 'substitute-shape', 'state-by-color-alone'],
});
