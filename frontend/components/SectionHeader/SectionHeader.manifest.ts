import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'SectionHeader',
  category: 'foundation',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Names a section so a worker can tell at a glance what a block of the screen is about.',
  jobs: [
    'Names a section, card or page with a heading at the right size, so the worker can tell where they are and screen-reader users can move by heading.',
    'Used at the top of every zone and card. It can carry a trailing item, such as a count or a link, on its end.',
  ],
  contract: { kind: 'none', reason: 'Foundation primitives are not data-bearing, so they declare no data contract (BRD 1.2 5.5). It takes the heading text, a heading level and a size, and an optional trailing item.' },
  governance: [
    { rule: 'It renders only the three sizes small to large, never below small or above large.', source: 'BRD 1.2 5.5 (SectionHeader, prohibited)' },
    { rule: 'It never carries data values: it names a section and shows nothing the canvas computed.', source: 'BRD 1.2 5.5 (SectionHeader, prohibited)' },
    { rule: 'It emits no event itself. A trailing action it holds emits its own event.', source: 'BRD 1.2 5.5 (SectionHeader, events)' },
    { rule: 'The heading level is supplied by the caller and rendered as a real heading.', source: 'BRD 1.2 5.5 (SectionHeader, props)' },
  ],
  dimensions: { data: NA, interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'semantic heading level',
    reducedMotion: NA,
  },
  prohibited: ['size-outside-sm-to-lg', 'carry-data-values'],
});
