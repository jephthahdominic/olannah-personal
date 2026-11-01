import type { Wire } from '..';

// The PROPOSED dashboard zone (PROPOSED_DASHBOARD_ZONE.md), as the approved design "03 Dashboard" needs it. It is NOT delivered by the
// practice API yet: mock mode attaches it to the technician's context so the design can be built and seen, and a test proves it passes the
// same validation a delivered zone would. Raw JSON-shaped data, written the way the backend would send it.
//
// The job is the practice API's own active work order (WO-4471), so the Dashboard and the job workspace never disagree about which job it is.
// The other stops are made up.

export type DashboardVariant = 'ready' | 'insight' | 'client-update' | 'no-jobs';

const AS_OF = '2026-10-23T08:00:03-05:00';

const today: Wire.DashboardGroup = {
  heading: 'Today',
  title: 'Later today',
  caption: '2 stops',
  items: [
    { id: 'WO-5102', time_local: '13:15', title: 'Union Coffee Roasters', subtitle: 'Preventive maintenance', status: { label: 'Late', tone: 'error' } },
    { id: 'WO-5110', time_local: '15:40', title: 'Beacon Hotel', subtitle: 'Ice maker inspection', status: null },
  ],
};

const tomorrow: Wire.DashboardGroup = {
  heading: 'Tomorrow',
  title: 'Scheduled',
  caption: '2 stops',
  items: [
    { id: 'WO-5121', time_local: '08:00', title: 'Brandon Medical Office', subtitle: 'Boiler not firing on stage 2', status: null },
    { id: 'WO-5127', time_local: '12:00', title: 'Beacon Hotel', subtitle: 'Ice maker repair', status: null },
  ],
};

const nextJob: Wire.DashboardNextJob = {
  eyebrow: 'Next job',
  reference: 'WO-4471',
  time_local: '08:00',
  title: 'Northfield Grocers, Store 118',
  subtitle: 'Compressor fault - walk-in cooler temp alarm',
  location: 'Receiving dock',
  status: { label: 'Urgent', tone: 'warning' },
  action_label: 'Open work order',
  note: null,
  insight: null,
};

const base: Wire.DashboardData = {
  greeting: 'Good morning, Marcus',
  date: 'Friday, October 23',
  jobs_heading: 'Your jobs',
  counts: [
    { id: 'urgent', label: 'Urgent', value: 1, status: 'warning' },
    { id: 'late', label: 'Late', value: 1, status: 'error' },
    { id: 'upcoming', label: 'Upcoming', value: 2, status: null },
  ],
  next_job: nextJob,
  today,
  tomorrow,
};

const INSIGHT = {
  type: 'insight',
  schemaVersion: '1.0',
  payload: { title: 'Bring a discharge valve', body: 'The V-221 valve is not in your van, and V-224 was used as a substitute on Sep 18.' },
};

const NOTE: Wire.DashboardNote = {
  author: 'Store manager',
  time_local: '08:02',
  text: 'Use the south receiving entrance. Call on arrival; the cooler aisle is restricted.',
};

const DATA: Record<DashboardVariant, Wire.DashboardData> = {
  ready: base,
  insight: { ...base, next_job: { ...nextJob, insight: INSIGHT } },
  'client-update': { ...base, next_job: { ...nextJob, note: NOTE } },
  'no-jobs': {
    ...base,
    counts: [
      { id: 'urgent', label: 'Urgent', value: 0, status: null },
      { id: 'late', label: 'Late', value: 0, status: null },
      { id: 'upcoming', label: 'Upcoming', value: 0, status: null },
    ],
    next_job: null,
    today: null,
    tomorrow: null,
  },
};

/** The dashboard zone as it would be delivered, for one of the designed situations. A fresh object every call. */
export function dashboardZone(variant: DashboardVariant = 'ready'): { state: 'rendered'; as_of: string; data: Wire.DashboardData } {
  return { state: 'rendered', as_of: AS_OF, data: structuredClone(DATA[variant]) };
}

/** A raw context with the dashboard zone added. The zone is part of `zones`, as every other zone is. */
export function withDashboard<T extends { zones: Record<string, unknown> }>(context: T, variant: DashboardVariant = 'ready'): T {
  return { ...context, zones: { ...context.zones, dashboard: dashboardZone(variant) } };
}
