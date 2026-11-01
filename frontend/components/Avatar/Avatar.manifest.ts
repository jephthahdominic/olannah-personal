import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'Avatar',
  category: 'data-display',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows a worker who they are signed in as.',
  jobs: [
    'Shows who the signed-in worker is as a small round marker in the topbar, with the worker\'s full name for screen readers.',
    'It shows initials only when they are supplied. Otherwise it shows a person symbol.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'initials', type: '1 to 3 characters', required: false, meaning: 'The worker\'s initials, exactly as supplied.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Shows a person symbol. The component never works initials out from the name.' },
      { field: 'label', type: 'text', required: true, meaning: 'The worker\'s full name, read out by assistive technology.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Cannot be shown without a name.' },
    ],
  },
  governance: [
    { rule: 'It never derives initials from a name. Render what is supplied.', source: 'BRD 1.0 section 4 (the canvas is render-driven, not decision-driven); BRD 1.2 5.2 Feature 7B' },
    { rule: 'It is announced as an image with the worker\'s full name.', source: 'BRD 1.2 5.14 Feature 1' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  gaps: [
    'It fills its own background with the chrome surface token. BRD 1.2 5.5.1 Feature 1A reserves structural backgrounds for Surface, so Design needs to rule whether a small marker like this may set one.',
  ],
  outsideCatalogue: 'BRD 1.2 5.1.1 lists the data display components and Avatar is not one of them. It was added for the topbar in the approved designs. It needs approval through library governance.',
  dimensions: { data: ['ready'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'role=img with full name',
    reducedMotion: NA,
  },
  prohibited: ['derive-initials-from-name'],
});
