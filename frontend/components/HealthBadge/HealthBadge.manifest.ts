import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'HealthBadge',
  category: 'feedback-status',
  priority: 'P0.5',
  personas: ['estimator'],
  lifecycle: 'ephemeral',
  job: 'Tells an estimator whether a connected system is available.',
  jobs: [
    'Tells an estimator whether a connected system, such as a supplier or a records system, is available right now.',
    'It shows available, limited or unavailable with a shape and a label, and says separately if the live feed is lost.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'availability', type: 'available, degraded or unavailable', required: true, meaning: 'The condition of the upstream system, supplied. Never worked out.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'connection', type: 'connected, reconnecting or disconnected', required: false, meaning: 'Whether the feed that reports availability is live. A lost feed is not shown as current availability.', freshness: 'As delivered.', whenAbsent: 'Treated as connected.' },
      { field: 'label', type: 'text', required: true, meaning: 'The plain-language statement for assistive technology.', freshness: 'As delivered.', whenAbsent: 'Not rendered without a label.' },
    ],
  },
  governance: [
    { rule: 'It renders supplied availability and derives none.', source: 'BRD 1.2 5.8 (HealthBadge, prohibited)' },
    { rule: 'Colour is never the only carrier of the state. Each state has its own shape.', source: 'BRD 1.2 5.8.1 Feature 4A; BRD 1.3 section 9.4' },
    { rule: 'An unavailable or degraded system looks different from a failed operation.', source: 'BRD 1.2 5.8.1 Feature 1A' },
  ],
  dimensions: { data: ['ready', 'degraded', 'error'], interaction: NA, runtime: ['connected', 'reconnecting', 'disconnected'] },
  events: [],
  a11y: {
    contrast: 'shape 3:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'role=img with a supplied label',
    reducedMotion: 'loading ring stops',
  },
  prohibited: ['derive-availability', 'color-alone', 'present-lost-feed-as-current-availability'],
});
