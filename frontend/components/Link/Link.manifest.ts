import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Link',
  category: 'foundation',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Takes a worker to a secondary place, such as support or feedback, without leaving their task.',
  jobs: [
    'Takes the worker somewhere else or opens a secondary surface, such as the feedback entry in the topbar or a link inside a sentence.',
    'It is for moving around, never for doing something that changes data.',
  ],
  contract: { kind: 'none', reason: 'Foundation primitives are not data-bearing, so they declare no data contract (BRD 1.2 5.5). It takes a label naming where it goes, the destination or surface it opens, and a contextual flag.' },
  governance: [
    { rule: 'Its label names the outcome, not the mechanism.', source: 'BRD 1.2 5.5.1 Feature 4A' },
    { rule: 'Its touch target is at least 44 by 44 pixels at every breakpoint.', source: 'BRD 1.2 5.5.1 Feature 5A' },
    { rule: 'It is never styled as a Button, and a Button is never styled as a Link.', source: 'BRD 1.2 5.5 (Link, prohibited)' },
    { rule: 'It never carries a destructive or write action. Those go through a Button and the checkpoint.', source: 'BRD 1.2 5.5 (Link, prohibited)' },
    { rule: 'It has three interaction states: default, hover and focus.', source: 'BRD 1.2 5.5 (Link, state dimensions)' },
  ],
  dimensions: { data: NA, interaction: ['default', 'hover', 'focus'], runtime: NA },
  events: ['activate'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px minimum',
    focus: 'visible keyboard focus ring',
    announcement: 'link name',
    reducedMotion: NA,
  },
  prohibited: ['styled-as-button', 'carry-write-or-destructive-action'],
});
