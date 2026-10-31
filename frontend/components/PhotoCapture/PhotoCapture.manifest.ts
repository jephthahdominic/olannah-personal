import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'PhotoCapture',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician'],
  lifecycle: 'ephemeral',
  job: 'Asks a worker for a photo and opens the camera, so required evidence is not missed.',
  jobs: [
    'Asks the worker for a photo, such as the data plate, and opens the device\'s camera or photo picker when they choose to take it.',
    'It shows the photos already captured as small previews, and says when a photo is required. It never stores or uploads anything: it hands the files to the canvas.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'prompt', type: 'text', required: true, meaning: 'What to photograph, such as \'Photograph the data plate\'. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the prompt is required.' },
      { field: 'captureLabel', type: 'text', required: true, meaning: 'The outcome-named label for the capture button. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the label is required.' },
      { field: 'required', type: 'true or false', required: false, meaning: 'Whether the photo is required, as the canvas supplied it. The component never works out whether a photo satisfies a requirement.', freshness: 'As delivered.', whenAbsent: 'Treated as not required.' },
      { field: 'requiredLabel', type: 'text', required: true, meaning: 'The words shown when the photo is required, such as \'Required\'. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not shown unless the photo is required.' },
      { field: 'captured', type: 'list of id, previewUrl and label', required: true, meaning: 'The photos already captured, supplied back after capture. Each has a preview address and an accessible description.', freshness: 'As delivered. The component owns no capture or upload session.', whenAbsent: 'Shows the supplied empty message.' },
      { field: 'emptyMessage', type: 'text', required: true, meaning: 'What is shown when nothing has been captured. Supplied.', freshness: 'As delivered.', whenAbsent: 'Not accepted: the message is required.' },
    ],
  },
  governance: [
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'It is an entry point. An active capture or upload session is owned by a separate surface and never held as authoritative state inside this component.', source: 'BRD 1.2 5.7.1 Feature 7A' },
    { rule: 'It never derives whether a photo satisfies a requirement, and never writes the image anywhere.', source: 'BRD 1.2 5.7 (PhotoCapture, prohibited)' },
    { rule: 'It emits capture-request when the worker asks to capture, and capture-complete with the files the device returned, untouched.', source: 'BRD 1.2 5.7 (PhotoCapture, events)' },
    { rule: 'It is on the watchlist: a future capture-session surface is expected to own camera, upload and retry state.', source: 'BRD 1.2 5.7.1 Feature 7A (notes)' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: ['empty', 'ready'], interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['capture-request', 'capture-complete'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px capture button',
    focus: 'visible keyboard focus ring',
    announcement: 'thumbnails carry supplied alt text; required is visible text',
    reducedMotion: NA,
  },
  prohibited: ['own-capture-or-upload-session', 'write-image-anywhere', 'derive-whether-photo-satisfies-requirement'],
});
