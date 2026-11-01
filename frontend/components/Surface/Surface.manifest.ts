import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Surface',
  category: 'foundation',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Gives every card, panel and band its correct background, so all screens sit on the same structural layers.',
  jobs: [
    'Gives every card, panel, raised region and page background its colour, so every screen reads as one coherent surface.',
    'Used by every zone, card and panel, and by the topbar and navigation (the chrome). A zone\'s surface is fixed by its structural role, not by what it shows.',
  ],
  contract: { kind: 'none', reason: 'Foundation primitives are not data-bearing, so they declare no data contract (BRD 1.2 5.5). It takes presentation settings only: a surface role (workspace, card, panel or chrome), a padding token and the content to hold.' },
  governance: [
    { rule: 'It is the only component that owns a structural container background. Other components may use only the semantic or interactive fills defined for their category in Document 1.3.', source: 'BRD 1.2 5.5.1 Feature 1A' },
    { rule: 'It renders only the workspace, card, panel or chrome background token, and never a colour outside those four.', source: 'BRD 1.2 5.5.1 Feature 1B' },
    { rule: 'It has no shadow or elevation.', source: 'BRD 1.2 5.5 (Surface, prohibited)' },
    { rule: 'It holds presentation state only: no business or workflow state.', source: 'BRD 1.2 5.2 Feature 4A' },
  ],
  dimensions: { data: NA, interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1 on its surface',
    touchTarget: NA,
    focus: NA,
    announcement: NA,
    reducedMotion: NA,
  },
  prohibited: ['structural-background-outside-four-surface-tokens', 'shadow-or-elevation', 'outer-margin'],
});
