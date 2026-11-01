import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'MoreMenu',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Gives a worker the less common places and actions that do not fit the tab bar.',
  jobs: [
    'Gives a worker the less common places and actions that do not fit the tab bar.',
    'It sits above the screen on a dim overlay and closes when asked.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'open', type: 'true or false', required: true, meaning: 'Whether the menu is open. The composing layer owns it.', freshness: 'As delivered.', whenAbsent: 'Closed.' },
      { field: 'actions', type: 'list of actions', required: true, meaning: 'The three fixed actions, supplied. Never varied by role here.', freshness: 'As delivered.', whenAbsent: 'Shows nothing to choose.' },
      { field: 'overflowDestinations', type: 'list of destinations', required: false, meaning: 'Destinations that did not fit. Supplied; the menu never works out which overflow.', freshness: 'As delivered.', whenAbsent: 'None shown.' },
    ],
  },
  governance: [
    { rule: 'Its dim overlay uses the overlay token as a system-surface treatment, not a Surface background.', source: 'BRD 1.2 5.15.1 Feature 3A' },
    { rule: 'The composing layer owns whether it is open. The menu emits a close request.', source: 'BRD 1.2 5.15.1 Feature 4A' },
    { rule: 'It never varies the three actions by role or derives which destinations overflow.', source: 'BRD 1.2 5.15 (MoreMenu, prohibited)' },
    { rule: 'It is non-interactive while a blocking checkpoint is active.', source: 'BRD 1.2 5.15.1 Feature 5A' },
  ],
  gaps: [
    'BRD 1.1 (Navigation) was not provided.',
  ],
  dimensions: { data: ['ready', 'empty'], interaction: ['default', 'focus'], runtime: NA },
  events: ['close-request', 'action-select', 'destination-select'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px items',
    focus: 'focus moves in, is trapped, and returns to the opener',
    announcement: 'role=menu',
    reducedMotion: 'transitions replaced by 150ms fade',
  },
  prohibited: ['own-authoritative-open-state', 'vary-actions-by-role', 'derive-overflow', 'own-route-transition'],
});
