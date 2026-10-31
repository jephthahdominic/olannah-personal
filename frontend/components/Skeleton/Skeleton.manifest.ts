import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Skeleton',
  category: 'feedback-status',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Holds the place of content that is still loading so the screen does not jump.',
  jobs: [
    'Holds the place of content that is still loading, in the same shape, so the screen does not jump when it arrives.',
    'It is the only loading treatment for data. A control that is working shows its own inline progress instead.',
  ],
  contract: { kind: 'none', reason: 'Skeleton renders no worker data. It takes a shape from the design system table and an optional card height, and shimmers unless the worker prefers reduced motion (BRD 1.2 5.8).' },
  governance: [
    { rule: 'Skeleton is the standard loading representation for data-bearing content whose structure is known. No spinner or ad hoc loading treatment is used where it applies.', source: 'BRD 1.2 5.8.1 Feature 6A; BRD 1.3 section 8.3' },
    { rule: 'An action that is processing keeps its control in place with an inline progress indicator. It is never a Skeleton.', source: 'BRD 1.2 5.8.1 Feature 6B' },
    { rule: 'It never shimmers on an action button or a card frame, and it disappears as soon as the content resolves.', source: 'BRD 1.2 5.8 (Skeleton, prohibited); BRD 1.3 section 8.3' },
    { rule: 'When the worker prefers reduced motion, the shimmer stops and the placeholders sit still.', source: 'BRD 1.3 section 11.5' },
  ],
  dimensions: { data: NA, interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: NA,
    touchTarget: NA,
    focus: NA,
    announcement: 'aria-hidden',
    reducedMotion: 'shimmer stops',
  },
  prohibited: ['shimmer-on-action-button-or-card-frame', 'represent-action-processing', 'persist-after-content-resolves'],
});
