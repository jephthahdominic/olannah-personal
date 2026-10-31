import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Button',
  category: 'foundation',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker take an action, and shows them it was accepted while it works.',
  jobs: [
    'Lets the worker do something. It names the outcome, tells the canvas it was used, and shows progress in place while the result is awaited.',
    'Used for every action in forms, banners, empty and error states, and checkpoints. It decides nothing: the canvas decides what happens.',
  ],
  contract: { kind: 'none', reason: 'Foundation primitives are not data-bearing, so they declare no data contract (BRD 1.2 5.5). It takes a label naming the outcome, a variant (primary, accent or ghost), an optional leading icon, and disabled and processing flags.' },
  governance: [
    { rule: 'It emits an activate event and executes no business or workflow consequence itself.', source: 'BRD 1.2 5.5.1 Feature 3A; BRD 1.2 5.2 Feature 2' },
    { rule: 'A button whose action would change a source system goes through the checkpoint and never writes directly.', source: 'BRD 1.2 5.5.1 Feature 3B' },
    { rule: 'Its label names the outcome, not the mechanism, and keeps the same name through its flow. Generic labels such as submit, OK, yes or cancel are not used where a specific one applies.', source: 'BRD 1.2 5.5.1 Feature 4A' },
    { rule: 'Its touch target is at least 44 by 44 pixels at every breakpoint.', source: 'BRD 1.2 5.5.1 Feature 5A; BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'It has six interaction states: default, hover, pressed, focus, disabled and processing. While processing it stays in place and ignores repeat activation.', source: 'BRD 1.2 5.5 (Button, state dimensions and prohibited)' },
  ],
  dimensions: { data: NA, interaction: ['default', 'hover', 'pressed', 'focus', 'disabled', 'processing'], runtime: NA },
  events: ['activate'],
  a11y: {
    contrast: 'text 4.5:1 on fill',
    touchTarget: '44px minimum',
    focus: 'visible keyboard focus ring',
    announcement: 'aria-busy while processing',
    reducedMotion: 'transitions replaced by 150ms fade',
  },
  prohibited: ['execute-business-consequence', 'touch-target-below-44px', 'mechanism-named-label', 'interactive-while-processing'],
});
