import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'NavItem',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Takes a worker to one destination, and shows them whether it is where they are or is unavailable.',
  jobs: [
    'Takes a worker to one destination, and shows them whether it is where they are or is currently unavailable.',
    'It is the unit the rail, the tab bar and the More menu are built from.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'destinationId', type: 'text', required: true, meaning: 'The stable identifier of the destination. Matching uses ids, never labels or routes.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'label', type: 'text', required: true, meaning: 'The destination name, as supplied. A tenant may override it.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'icon', type: 'a Tabler outline glyph', required: true, meaning: 'The icon for the destination.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'active', type: 'true or false', required: false, meaning: 'Whether this is where the worker is. Supplied by the routing layer.', freshness: 'As delivered.', whenAbsent: 'Not active.' },
      { field: 'unavailable, unavailableReason', type: 'true or false, text', required: false, meaning: 'A destination that cannot be reached now, and why. Supplied.', freshness: 'As delivered.', whenAbsent: 'Available.' },
    ],
  },
  governance: [
    { rule: 'Active is a supplied condition. No component works out whether it is active, and at most one item is active.', source: 'BRD 1.2 5.15.1 Feature 2A' },
    { rule: 'Active is not shown by colour alone.', source: 'BRD 1.2 5.15.1 Feature 2B; BRD 1.3 section 7.6' },
    { rule: 'Unavailable keeps full contrast and does not use the reduced-opacity disabled treatment.', source: 'BRD 1.2 5.15.1 Feature 6A; BRD 1.3 section 7.5' },
    { rule: 'An unavailable item stays focusable, activates to the supplied explanation instead of navigating, and announces its reason.', source: 'BRD 1.2 5.15.1 Feature 6B' },
    { rule: 'It never works out why a destination is unavailable.', source: 'BRD 1.2 5.15.1 Feature 6C' },
    { rule: 'It emits a selection event upward. The canvas performs the navigation.', source: 'BRD 1.2 5.15.1 Feature 1B' },
  ],
  gaps: [
    'BRD 1.1 (Navigation), which owns assembly and active logic, was not provided.',
  ],
  dimensions: { data: NA, interaction: ['default', 'hover', 'pressed', 'focus', 'disabled'], runtime: NA },
  events: ['activate'],
  a11y: {
    contrast: 'Warm Cream 9.6:1 on Evergreen Dark; indicator 3:1',
    touchTarget: '44px minimum',
    focus: 'visible keyboard focus ring',
    announcement: 'aria-current for active, aria-describedby reason for unavailable',
    reducedMotion: 'transitions replaced by 150ms fade',
  },
  prohibited: ['determine-active', 'determine-unavailable', 'perform-route-transition', 'dim-unavailable', 'active-by-color-alone'],
});
