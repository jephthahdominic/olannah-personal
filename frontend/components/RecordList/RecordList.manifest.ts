import { defineComponent, NA } from '../manifest';

export const manifest = defineComponent({
  name: 'RecordList',
  category: 'data-display',
  priority: 'P0',
  personas: ['technician', 'estimator'],
  lifecycle: 'ephemeral',
  job: 'Shows a worker a list of jobs or records, in the order the canvas gave them.',
  jobs: [
    'Shows an ordered set of records as rows, such as a list of jobs or items. A row can be selected to open the record.',
    'Used for queues, schedules and the assigned jobs. When there are none, it says why and what would cause records to appear.',
  ],
  contract: {
    kind: 'fields',
    fields: [
      { field: 'records', type: 'list of records', required: true, meaning: 'The set of records to show, in the order the canvas wants them shown. Each record conforms to the row contract below.', freshness: 'As delivered. A set that is stale is presented through the degraded state, never as current.', whenAbsent: 'Shows the empty state with the supplied explanation. It is never blank.' },
      { field: 'records[].id', type: 'text', required: true, meaning: 'A stable identifier for the record, used to say which row was selected.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'A record without one is not shown.' },
      { field: 'records[].title', type: 'text', required: true, meaning: 'The main line of the row, exactly as supplied.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'The row is not shown.' },
      { field: 'records[].subtitle', type: 'text', required: false, meaning: 'A supporting line, exactly as supplied.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'No second line is shown.' },
      { field: 'records[].timeLocal', type: 'site-local time, HH:MM', required: false, meaning: 'A wall-clock time at the site. It is formatted and never converted to the viewer\'s time zone.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'No time is shown.' },
      { field: 'records[].trailing', type: 'text', required: false, meaning: 'A short value at the end of the row, exactly as supplied.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'Nothing is shown at the end.' },
      { field: 'records[].status', type: 'label and tone', required: false, meaning: 'A status the canvas supplied for the record, shown by StatusPill.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'No status is shown. It is never derived.' },
      { field: 'emptyTitle, emptyExplanation', type: 'text', required: true, meaning: 'Why there is nothing here and what would cause records to appear. Supplied text, never generated from a code.', freshness: 'As delivered. The component shows no age; where age matters the composing layer shows it.', whenAbsent: 'This is the content of the empty state itself.' },
    ],
  },
  governance: [
    { rule: 'Records appear in the order supplied. The list never sorts or reorders them for correctness.', source: 'BRD 1.2 5.6.1 Feature 2A; BRD 1.2 5.6 (RecordList, prohibited)' },
    { rule: 'Which records to show may follow relevance configuration. A record is never hidden because the list judged it incorrect.', source: 'BRD 1.2 5.6.1 Feature 2B; BRD 1.2 5.2 Feature 7C' },
    { rule: 'It fetches nothing and shows no count or summary it worked out itself.', source: 'BRD 1.2 5.6 (RecordList, prohibited)' },
    { rule: 'An empty set shows the empty state with a supplied explanation, never a blank list.', source: 'BRD 1.2 5.6.1 Feature 5A' },
    { rule: 'It emits row-select with the record\'s id and does nothing else with it. Rows are buttons only when selection is supplied.', source: 'BRD 1.2 5.6 (RecordList, events)' },
    { rule: 'Every visual value comes from a design token. No colour, spacing, type size or elevation is hardcoded.', source: 'BRD 1.2 5.2 Feature 5A' },
  ],
  gaps: [
    'BRD 1.2 5.6 gives a record list five data states: loading, ready, empty, degraded and error. This component implements ready and empty. The composing layer shows a skeleton or a degraded or unavailable message around it today.',
  ],
  dimensions: { data: ['ready', 'empty'], interaction: ['default', 'hover', 'focus'], runtime: NA },
  events: ['row-select'],
  a11y: {
    contrast: 'text 4.5:1',
    touchTarget: '44px rows',
    focus: 'visible keyboard focus ring on selectable rows',
    announcement: 'labelled list; rows are buttons when selectable',
    reducedMotion: NA,
  },
  prohibited: ['sort-or-filter-for-correctness', 'fetch-records', 'compute-count-or-summary', 'render-blank-when-empty'],
});
