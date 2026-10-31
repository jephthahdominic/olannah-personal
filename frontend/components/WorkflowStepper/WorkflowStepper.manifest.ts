import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'WorkflowStepper',
  category: 'data-display',
  priority: 'P0',
  personas: ['technician'],
  lifecycle: 'persistence-capable',
  job: 'Shows a worker the steps of the job, which are done and which one is next.',
  jobs: [
    'Shows the steps of a guided job in order, which are done and which one the worker is on, so they always know where they are.',
    'A worker can open a step to read it and ask to move it forward. The stepper itself never completes or advances anything: the canvas decides, and any change goes through the checkpoint.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'steps', type: 'ordered list of steps', required: true, meaning: 'The steps of the workflow in the order the canvas wants them shown.', freshness: 'As delivered. The canvas decides when a step\'s completion changes.', whenAbsent: 'Shows nothing. The composing layer chooses the empty state.' },
      { field: 'steps[].id', type: 'text', required: true, meaning: 'A stable identifier for the step, used to say which step was opened or advanced.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'The step is not shown.' },
      { field: 'steps[].label', type: 'text', required: true, meaning: 'The name of the step, exactly as supplied.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'The step is not shown.' },
      { field: 'steps[].completion', type: 'complete or incomplete', required: true, meaning: 'Whether the step is done, as the canvas supplied it. The stepper never works it out from other data.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'The step is not shown.' },
      { field: 'steps[].statusLabel', type: 'text', required: true, meaning: 'The words shown for the step\'s completion, such as Done. Supplied, so completion is never colour alone.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'The step is not shown.' },
      { field: 'steps[].detail', type: 'text', required: false, meaning: 'What is shown when the step is opened.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Nothing is shown when the step is opened.' },
      { field: 'steps[].advanceLabel', type: 'text', required: false, meaning: 'The outcome-named label for the request to move the step forward, such as \'Complete safety pre-check\'.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'No advance control is offered for that step.' },
      { field: 'activeStepId', type: 'text or none', required: true, meaning: 'Which step is the current one, as the canvas supplied it. Never computed.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'No step is marked current.' },
      { field: 'initialContinuity', type: 'which step was open', required: false, meaning: 'What was open when the stepper was last on screen. Handed in by the shell. It is presentation continuity only, never progress.', freshness: 'Only for the current session.', whenAbsent: 'The current step opens.' },
    ],
  },
  governance: [
    { rule: 'It never advances or completes a step itself. It emits step-advance and the canvas decides.', source: 'BRD 1.2 5.6 (WorkflowStepper, prohibited and events)' },
    { rule: 'It never derives completion from data and never holds authoritative workflow progress.', source: 'BRD 1.2 5.6 (WorkflowStepper, prohibited); BRD 1.0 SR16B' },
    { rule: 'It is persistence-capable for continuity only: scroll position, the open step and similar. The shell decides whether an instance persists, and the component never elects itself.', source: 'BRD 1.2 5.4; BRD 1.0 SR17A and 17B' },
    { rule: 'What persists is presentation continuity. Authoritative workflow, business and session state is never carried across.', source: 'BRD 1.0 SR17C' },
    { rule: 'A change a step would cause to a source system goes through the checkpoint, never directly.', source: 'BRD 1.2 5.5.1 Feature 3B' },
    { rule: 'It renders supplied values and derives, computes or resolves nothing. No value, status or summary appears that was not in the supplied data.', source: 'BRD 1.2 5.6.1 Feature 1A; BRD 1.2 5.2 Feature 7B' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  gaps: [
    'Each step fills its own background with the card surface token. BRD 1.2 5.5.1 Feature 1A reserves structural backgrounds for Surface, so Design needs to rule whether a step may set one.',
  ],
  dimensions: { data: ['ready', 'empty'], interaction: ['default', 'hover', 'focus'], runtime: NA },
  events: ['step-select', 'step-advance', 'continuity'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px step headers',
    focus: 'visible keyboard focus ring',
    announcement: 'ordered list; aria-current=step for the active step; aria-expanded on headers; completion is visible text',
    reducedMotion: NA,
  },
  prohibited: ['advance-or-complete-step', 'derive-completion', 'hold-authoritative-workflow-progress', 'elect-own-persistence', 'completion-by-color-alone'],
});
