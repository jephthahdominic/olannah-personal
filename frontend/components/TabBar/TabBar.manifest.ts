import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'TabBar',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Gives a phone worker the main places they can go, always within thumb reach.',
  jobs: [
    'Gives a phone worker the main places they can go, always within thumb reach at the bottom.',
    'It shows what the canvas gives it, in the order given.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'items', type: 'list of destinations', required: true, meaning: 'The destinations for this worker, in order. Supplied; never filtered or reordered here.', freshness: 'As delivered.', whenAbsent: 'Shows an empty bar.' },
      { field: 'menuOpen', type: 'true or false', required: false, meaning: 'Whether the More menu is open, so the More item shows it.', freshness: 'As delivered.', whenAbsent: 'Closed.' },
    ],
  },
  governance: [
    { rule: 'It renders the item set, order and active destination supplied by the canvas. It resolves no route, reorders nothing and decides no persona visibility.', source: 'BRD 1.2 5.15.1 Feature 1A' },
    { rule: 'It emits a selection event upward. The canvas performs the navigation.', source: 'BRD 1.2 5.15.1 Feature 1B' },
    { rule: 'It is non-interactive while a blocking checkpoint is active.', source: 'BRD 1.2 5.15.1 Feature 5A' },
  ],
  gaps: [
    'BRD 1.1 (Navigation) was not provided.',
  ],
  dimensions: { data: ['ready', 'empty'], interaction: NA, runtime: NA },
  events: ['item-select'],
  a11y: {
    contrast: 'Warm Cream 9.6:1',
    touchTarget: '44px items',
    focus: 'document order',
    announcement: 'labelled navigation landmark',
    reducedMotion: NA,
  },
  prohibited: ['reorder-or-filter-items', 'resolve-persona-set', 'own-route-transition'],
});
