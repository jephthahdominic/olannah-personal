import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Icon',
  category: 'foundation',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Gives a worker a quick visual cue for an action or condition, always beside its words.',
  jobs: [
    'Shows one small symbol that carries meaning or helps the worker find their way, in the colour of the place it sits.',
    'Used inside buttons, navigation items, banners and status shapes. It is never the only carrier of meaning where a word is needed.',
  ],
  contract: { kind: 'none', reason: 'Foundation primitives are not data-bearing, so they declare no data contract (BRD 1.2 5.5). It takes a glyph name, a size (extra small to extra large) and either an accessible label or a decorative flag.' },
  governance: [
    { rule: 'It renders only Tabler outline glyphs. No other icon family and no filled variant is used.', source: 'BRD 1.2 5.5.1 Feature 2A; BRD 1.3 section 9' },
    { rule: 'An informative icon carries an accessible label. A decorative icon is hidden from assistive technology, and one left unmarked is a defect.', source: 'BRD 1.2 5.5.1 Feature 2B' },
    { rule: 'It never sets its own colour. It inherits the colour of its context.', source: 'BRD 1.2 5.5 (Icon, prohibited)' },
    { rule: 'Inside a Button it takes part in that Button\'s events and emits none of its own.', source: 'BRD 1.2 5.5 (Icon, events)' },
  ],
  dimensions: { data: NA, interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'inherits context color',
    touchTarget: NA,
    focus: NA,
    announcement: 'aria-label when informative, aria-hidden when decorative',
    reducedMotion: NA,
  },
  prohibited: ['non-tabler-glyph', 'filled-glyph', 'hardcoded-color', 'unmarked-decorative-icon'],
});
