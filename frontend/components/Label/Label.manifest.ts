import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Label',
  category: 'foundation',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Names a field or group in small capitals so a worker knows what a value belongs to.',
  jobs: [
    'Names a field, a group or a region in small uppercase microcopy, such as a field name above its value.',
    'Used above values in rows and lists, and to name a page\'s workspace. It is a visual caption, not a form label.',
  ],
  contract: { kind: 'none', reason: 'Foundation primitives are not data-bearing, so they declare no data contract (BRD 1.2 5.5). It takes the label text only.' },
  governance: [
    { rule: 'It never stands in for a form field\'s programmatic label. A field gets its label through FormField.', source: 'BRD 1.2 5.5 (Label, prohibited)' },
    { rule: 'It is uppercase microcopy only. It is never used for sentence-case body text at this size.', source: 'BRD 1.2 5.5 (Label, prohibited)' },
    { rule: 'It emits no event.', source: 'BRD 1.2 5.5 (Label, events)' },
  ],
  dimensions: { data: NA, interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'secondary text 4.5:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'plain text',
    reducedMotion: NA,
  },
  prohibited: ['substitute-for-form-label'],
});
