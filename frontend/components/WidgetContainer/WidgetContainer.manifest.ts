import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'WidgetContainer',
  category: 'widget',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows a worker an insight from the intelligence layer, or says plainly that it cannot.',
  jobs: [
    'Shows a worker an insight from the intelligence layer, or says plainly that it cannot show it.',
    'It checks the insight is well formed, draws it, and never interprets or acts on it.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'widget', type: 'a widget with a type, a schema version and a payload', required: true, meaning: 'Insight-layer output, supplied. Checked against the shared contract and drawn structurally. Never interpreted for business meaning.', freshness: 'As delivered.', whenAbsent: 'Shows the fallback message.' },
      { field: 'fallbackTitle, fallbackMessage', type: 'text', required: true, meaning: 'What the worker sees when the widget is unsupported or invalid. Supplied. Contains no version, type name or code.', freshness: 'As delivered.', whenAbsent: 'Not rendered.' },
    ],
  },
  governance: [
    { rule: 'Before rendering it checks the type and schema version are supported and the payload matches the contract. This decides renderability only, not whether the content is true.', source: 'BRD 1.2 5.11.1 Feature 2A' },
    { rule: 'It maps fields to UI. It derives no meaning, computes no value, resolves no ambiguity and ranks nothing.', source: 'BRD 1.2 5.11.1 Feature 3A' },
    { rule: 'An unknown, unsupported or non-conforming payload shows the fallback. It never crashes, goes blank or renders a best guess. Unsupported and invalid are recorded as different reasons.', source: 'BRD 1.2 5.11.1 Features 4A and 4B' },
    { rule: 'The fallback shows no schema version, type name or code to the worker.', source: 'BRD 1.2 5.11.1 Feature 4C' },
    { rule: 'The degraded state shows only when supplied, never inferred from a missing field.', source: 'BRD 1.2 5.11.1 Feature 5A' },
    { rule: 'At P0 a widget has no action control and starts no write.', source: 'BRD 1.2 5.11.1 Feature 7A' },
    { rule: 'It holds no copy of the payload and re-renders from a re-supplied one.', source: 'BRD 1.2 5.11.1 Feature 8A' },
  ],
  gaps: [
    'BRD 1.2 5.11 lists the props as widget type, schema version, payload and fallback message. The build takes one widget envelope that carries the type, the schema version and the payload together.',
    'BRD 1.2 section 7 question 3 (how the shared widget contract is governed) is open and must be resolved before this component is built.',
  ],
  dimensions: { data: ['loading', 'ready', 'empty', 'degraded', 'error', 'unsupported'], interaction: NA, runtime: NA },
  events: ['diagnostic'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: NA,
    focus: NA,
    announcement: 'plain text; fallback is plain language with no schema or type',
    reducedMotion: NA,
  },
  prohibited: ['derive-business-meaning', 'infer-degradation', 'execute-action', 'render-action-control', 'render-unknown-payload-as-guess', 'widget-local-primitives', 'hold-payload-as-authoritative', 'expose-schema-version-or-type'],
});
