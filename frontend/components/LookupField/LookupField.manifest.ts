import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'LookupField',
  category: 'input-control',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Lets a worker search for and pick a record, such as a work order or an asset.',
  jobs: [
    'Lets the worker find and pick a record by typing, such as an order or an asset, instead of entering it by hand.',
    'It reports what the worker typed and shows the results the canvas supplies. It never searches, ranks or filters them itself.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'query', type: 'text', required: true, meaning: 'What the worker has typed to search for, as the composing layer holds it.', freshness: 'Not applicable: it is the worker\'s own entry.', whenAbsent: 'Shows an empty field.' },
      { field: 'results', type: 'list of id, label and detail', required: true, meaning: 'The matches for the query, in the order the canvas wants them shown. Each is named by what it is. The field renders them and never fetches them.', freshness: 'As delivered, in response to the latest query. Timing and stale answers are handled outside the component.', whenAbsent: 'Shows the supplied empty message when the data state is empty.' },
      { field: 'results[].id', type: 'text', required: true, meaning: 'A stable identifier for the record, used to say which was chosen.', freshness: 'As delivered.', whenAbsent: 'The result is not shown.' },
      { field: 'results[].label', type: 'text', required: true, meaning: 'The record\'s name, exactly as supplied.', freshness: 'As delivered.', whenAbsent: 'The result is not shown.' },
      { field: 'results[].detail', type: 'text', required: false, meaning: 'A supporting line, such as a site or an identifier.', freshness: 'As delivered.', whenAbsent: 'No second line is shown.' },
      { field: 'data', type: 'idle, loading, ready or empty', required: true, meaning: 'The condition of the results, supplied. The field never works it out.', freshness: 'As delivered.', whenAbsent: 'Shows no list while idle.' },
      { field: 'emptyMessage, loadingMessage, resultsMessage', type: 'text', required: false, meaning: 'What is said and announced for no results, for waiting, and for a delivered set such as \'3 results\'. Supplied, never computed.', freshness: 'As delivered.', whenAbsent: 'The first two are required. The count announcement is skipped.' },
    ],
  },
  governance: [
    { rule: 'The composing layer owns the entered value and supplies it as a prop. The input renders it and keeps no authoritative copy, so it can remount without losing the value.', source: 'BRD 1.2 5.7.1 Feature 1A; BRD 1.2 5.2 Feature 4B' },
    { rule: 'No input executes a write. What the worker enters is emitted upward, and a write that needs confirmation follows the checkpoint.', source: 'BRD 1.2 5.7.1 Feature 1B' },
    { rule: 'It fetches nothing. What it shows is supplied by the canvas.', source: 'BRD 1.2 5.7.1 Feature 2A' },
    { rule: 'It reports the current query and renders only the supplied results. Query timing, request coordination, freshness and stale-response handling are owned outside the component.', source: 'BRD 1.2 5.7.1 Feature 2B' },
    { rule: 'It never ranks, filters or resolves results for correctness, and never holds the selection as authoritative.', source: 'BRD 1.2 5.7 (LookupField, prohibited)' },
    { rule: 'It is a combobox: the input keeps focus, the list is driven by arrow keys, and the open list and highlighted option are presentation state only.', source: 'BRD 1.2 5.7 (LookupField, state dimensions)' },
    { rule: 'Every input has a visible, programmatic label through FormField. Placeholder text is never the only label, and the label stays when the field holds a value.', source: 'BRD 1.2 5.7.1 Feature 3A' },
    { rule: 'Its touch target is at least 44 pixels on every breakpoint.', source: 'BRD 1.3 sections 6.9 and 11.3' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  dimensions: { data: ['loading', 'ready', 'empty'], interaction: ['default', 'focus', 'disabled'], runtime: NA },
  events: ['query-change', 'result-select', 'focus', 'blur'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px field and options',
    focus: 'visible keyboard focus ring; arrow keys move, Enter selects, Escape closes',
    announcement: 'ARIA combobox with listbox and aria-activedescendant; supplied status message is role=status',
    reducedMotion: NA,
  },
  prohibited: ['fetch-results', 'own-query-timing-or-cancellation', 'reject-stale-responses', 'rank-or-resolve-results', 'hold-selection-as-authoritative', 'placeholder-as-label'],
});
