import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'SyncDot',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells a worker whether the data in front of them is current, and whether they are connected.',
  jobs: [
    'Tells a worker whether the data in front of them is current, still updating or out of date, and separately whether they are connected.',
    'Freshness and connection are shown as two things, never one, so a lost connection is never mistaken for old data.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'freshness', type: 'fresh, syncing or stale', required: true, meaning: 'How current the data shown nearby is. Supplied, never worked out from a timestamp.', freshness: 'As delivered.', whenAbsent: 'Not rendered. A freshness is always required.' },
      { field: 'connectivity', type: 'connected, reconnecting or disconnected', required: false, meaning: 'The state of the worker\'s connection, kept apart from freshness.', freshness: 'As delivered.', whenAbsent: 'No connection marker is shown.' },
      { field: 'label', type: 'text', required: true, meaning: 'The plain-language statement of both conditions for assistive technology.', freshness: 'As delivered.', whenAbsent: 'Not rendered without a label.' },
    ],
  },
  governance: [
    { rule: 'Freshness and connectivity are two dimensions and are never collapsed into one condition.', source: 'BRD 1.2 5.8.1 Feature 1B' },
    { rule: 'A stale value is never presented as current.', source: 'BRD 1.2 5.8.1 Feature 1C' },
    { rule: 'It renders supplied freshness and derives none.', source: 'BRD 1.2 5.8 (SyncDot, prohibited); BRD 1.2 5.8.1 Feature 3A' },
    { rule: 'Colour is never the only carrier of the state.', source: 'BRD 1.2 5.8.1 Feature 4A' },
  ],
  dimensions: { data: ['ready', 'stale'], interaction: NA, runtime: ['connected', 'reconnecting', 'disconnected'] },
  events: [],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'visible text label',
    reducedMotion: NA,
  },
  prohibited: ['derive-freshness', 'conflate-freshness-with-connectivity', 'present-stale-as-fresh'],
});
