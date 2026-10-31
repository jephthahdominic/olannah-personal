import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'StatTile',
  category: 'data-display',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows a worker one summary figure, such as jobs today.',
  jobs: [
    'Shows one key figure with its name, such as jobs today, large enough to read at a glance.',
    'Used for summary figures in a row of tiles. The canvas supplies the figure and any caption. The tile never works either out.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'value', type: 'text or number', required: true, meaning: 'One figure the canvas supplied, such as a count or a total, exactly as supplied.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Shows the tile with an empty value. No placeholder is invented.' },
      { field: 'caption', type: 'text', required: false, meaning: 'A short supplied note about the figure, such as how many need attention.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'No caption is shown.' },
      { field: 'status', type: 'warning, error or none', required: false, meaning: 'The shape beside the figure, supplied: a warning triangle or an error circle. None shows no shape, including beside a zero. The tile never decides that a figure needs attention.', freshness: 'As delivered. The component shows no age.', whenAbsent: 'No shape is shown.' },
      { field: 'tone', type: 'default, attention or success', required: false, meaning: 'Emphasis chosen by the composing layer. It is a presentation choice, not a judgment the tile makes about the figure.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Shown in the default tone.' },
    ],
  },
  governance: [
    { rule: 'It renders a supplied figure and never computes one, such as a count, a total or a percentage.', source: 'BRD 1.2 5.6.1 Feature 1A; BRD 1.2 5.2 Feature 7B' },
    { rule: 'Emphasis is never carried by colour alone. The attention tone adds a border, and the caption text says what needs attention.', source: 'BRD 1.0 section 6 (Visual Treatment Rules)' },
    { rule: 'A required figure that is absent shows the empty state, never a blank or invented one.', source: 'BRD 1.2 5.6.1 Feature 5A' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  gaps: [
    'The tile fills its own background with the card surface token. BRD 1.2 5.5.1 Feature 1A reserves structural backgrounds for Surface, so this should either sit on a Surface or Design should rule that a tile may set its own.',
  ],
  outsideCatalogue: 'BRD 1.2 5.1.1 lists the data display components and StatTile is not one of them. It was added for the summary tiles in the approved designs. It binds the same rules as the other data display components and needs approval through library governance.',
  dimensions: { data: ['ready', 'empty'], interaction: NA, runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1 (caption uses the dark amber text token on attention)',
    touchTarget: NA,
    focus: NA,
    announcement: 'value then label then caption',
    reducedMotion: NA,
  },
  prohibited: ['compute-value', 'emphasis-by-color-alone', 'placeholder-for-absent-value'],
});
