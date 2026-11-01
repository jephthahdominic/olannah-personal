import { defineComponent, NA } from '../../manifest';

export const manifest = defineComponent({
  name: 'CheckpointOverlay',
  category: 'system-surface',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Stops everything else on screen until a worker has decided on a change.',
  jobs: [
    'Stops everything else on screen until a worker has decided on a change, and shows them who or what triggered it.',
    'It hosts the diff, the statement and the decision controls, and does not decide when it appears.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'title', type: 'text', required: true, meaning: 'The heading of the checkpoint, supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'triggeredBy', type: 'text', required: true, meaning: 'The system or workflow that triggered the checkpoint, supplied from the trigger event.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'description', type: 'text', required: true, meaning: 'What the checkpoint is for, supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
      { field: 'blockingNote', type: 'text', required: true, meaning: 'A statement that the rest of the canvas is paused, supplied.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
    ],
  },
  governance: [
    { rule: 'While active it prevents navigation or canvas recomposition that would replace the checkpoint, and the blocking is visible. A rotation or resize does not dismiss it.', source: 'BRD 1.2 5.10.1 Feature 5A; BRD 1.4 section 7' },
    { rule: 'It is ephemeral and never persists across a context replacement.', source: 'BRD 1.2 5.10 (CheckpointOverlay, prohibited)' },
    { rule: 'It renders the supplied trigger payload and never decides when it fires or executes the write.', source: 'BRD 1.2 5.10 (CheckpointOverlay, prohibited)' },
    { rule: 'It renders above the rest of the canvas, never behind or beside other content, and nothing outside it is reachable.', source: 'BRD 1.2 5.10 (CheckpointOverlay, prohibited); BRD 1.3 section 7.3' },
  ],
  gaps: [
    'BRD 1.4 (Human Checkpoint UI), which owns the checkpoint behaviour, was not provided. This specification follows only what BRD 1.2 and 1.3 say.',
  ],
  dimensions: { data: ['loading', 'ready', 'error'], interaction: ['default', 'focus'], runtime: NA },
  events: [],
  a11y: {
    contrast: 'text 4.5:1 on White; checkpoint text AAA is P1',
    touchTarget: 'children meet 44px',
    focus: 'moves to the container on mount and is trapped; never pre-focuses approve or reject; Escape does nothing',
    announcement: 'role=dialog aria-modal with a labelled heading; the appearance is announced assertively by the host',
    reducedMotion: 'appearance becomes a 150ms fade',
  },
  prohibited: ['persist-across-context-replacement', 'decide-when-it-fires', 'execute-the-write', 'render-behind-or-beside-other-content', 'offer-close-or-dismiss', 'close-on-escape'],
});
