import { defineComponent, NA } from '../../manifest';

export const manifest = defineComponent({
  name: 'CheckpointInitializing',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker a decision is being prepared, and that it will either appear or fail clearly.',
  jobs: [
    'Tells a worker a decision is being prepared, and that it will either appear or fail clearly within a set time.',
    'It is never an open-ended wait.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'statusMessage', type: 'text', required: true, meaning: 'What is happening, in plain words. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'timeoutMs', type: 'number of milliseconds', required: false, meaning: 'The window after which the wait ends and the error state shows. Supplied upstream.', freshness: 'As delivered.', whenAbsent: 'No timeout is emitted.' },
    ],
  },
  governance: [
    { rule: 'It resolves to a rendered diff or an error within its supplied window and never shows an indefinite loading state.', source: 'BRD 1.2 5.10.1 Feature 3A' },
    { rule: 'While it shows, the content is non-interactive and hidden from assistive technology, and the acknowledgment and decision controls appear only when the checkpoint is ready.', source: 'BRD 1.2 5.10 (CheckpointInitializing); BRD 1.2 5.10.1 Feature 9A' },
    { rule: 'It never resolves the diff itself.', source: 'BRD 1.2 5.10 (CheckpointInitializing, prohibited)' },
  ],
  gaps: [
    'BRD 1.4 (Human Checkpoint UI) was not provided. The 3000ms maximum window is named in BRD 1.2 section 6 as taken from 1.4 and is supplied, not set here.',
  ],
  dimensions: { data: ['loading'], interaction: NA, runtime: NA },
  events: ['timeout'],
  a11y: {
    contrast: NA,
    touchTarget: NA,
    focus: 'placeholders are inert and unfocusable',
    announcement: 'placeholders aria-hidden; a supplied status message is role=status',
    reducedMotion: 'shimmer stops',
  },
  prohibited: ['indefinite-or-ambiguous-loading', 'resolve-the-diff', 'persist-past-supplied-window', 'expose-placeholders-as-controls'],
});
