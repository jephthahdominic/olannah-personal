import type { ContextPanelData, DashboardData } from '../dashboard';

// Zone data fixtures from the approved designs (freezer scenario: Northgate Grocers #4830, WO-48213, FZ-02).
// Group C of the designs uses a different scenario (a cooler); the freezer one is used in five of the eight sets.

export const technicianDashboard: DashboardData = {
  kind: 'dashboard',
  headline: 'Good morning, Marcus',
  summaryTitle: 'Today summary',
  summary: [
    { id: 'jobs', label: 'Jobs today', value: 4, tone: 'default' },
    { id: 'late', label: 'Late', value: 1, tone: 'attention' },
    { id: 'on-schedule', label: 'On schedule', value: 3, tone: 'default' },
  ],
  featured: {
    eyebrow: 'Next job',
    reference: 'WO-48213',
    timeLocal: '10:30',
    title: 'Northgate Grocers #4830',
    subtitle: 'Walk-in freezer not recovering temperature',
    location: '2180 Harbor Avenue · Receiving bay',
    status: { label: 'Priority', tone: 'warning' },
    actionLabel: 'Open work order',
  },
  widgets: [
    {
      type: 'insight',
      schemaVersion: '1.0',
      payload: {
        title: 'Bring a defrost control kit',
        body: 'Three recent visits cite intermittent ice buildup after door-open events.',
        evidence: 'Service history: Aug 12 sensor reset; Sep 4 evaporator ice cleared; Sep 21 recovery exceeded 45 minutes.',
        label: 'Evidence-backed',
      },
    },
  ],
  queueTitle: 'Later today',
  queueCaption: '2 stops',
  queue: [
    { id: 'wo-48225', timeLocal: '13:15', title: 'Union Coffee Roasters', subtitle: 'Preventive maintenance' },
    { id: 'wo-48231', timeLocal: '15:40', title: 'Beacon Hotel', subtitle: 'Ice maker inspection' },
  ],
};

/** The same dashboard after a store-manager note is pushed (design group B, state 03 "Context update"). */
export const technicianDashboardWithNote: DashboardData = {
  ...technicianDashboard,
  notice: {
    title: 'Store-manager update received',
    body: 'At 8:02 AM, Nina added arrival and access instructions for Northgate Grocers #4830.',
    tone: 'success',
  },
  featured: {
    ...technicianDashboard.featured!,
    note: { author: 'Nina', text: 'Use the south receiving entrance. Call on arrival; the freezer aisle is restricted.' },
  },
};

export const estimatorDashboard: DashboardData = {
  kind: 'dashboard',
  headline: 'Estimator dashboard',
  summaryTitle: 'Today',
  summary: [
    { id: 'field-reviews', label: 'Field reviews', value: 6, caption: '2 need attention today', tone: 'attention' },
    { id: 'quote-drafts', label: 'Quote drafts', value: 4, caption: '$42,860 open value', tone: 'default' },
    { id: 'checkpoints', label: 'Checkpoints', value: 3, caption: 'No records written yet', tone: 'attention' },
  ],
  featured: null,
  queueTitle: 'Priority queue',
  queueCaption: 'Sorted by customer impact and due time.',
  queue: [
    { id: 'q-2291', title: 'Northgate Grocers #4830', subtitle: 'Review field evidence and build repair quote · WO-48213 · Q-2291', trailing: '38 min', status: { label: 'Review now', tone: 'warning' } },
    { id: 'wo-48240', title: 'Union Coffee Roasters', subtitle: 'Validate preventive-maintenance scope · WO-48240', trailing: '1h 12m', status: { label: 'Field review', tone: 'neutral' } },
    { id: 'q-2284', title: 'Bayview Senior Living', subtitle: 'Send approved rooftop-unit quote · Q-2284', trailing: '2h 05m', status: { label: 'Approved', tone: 'success' } },
    { id: 'q-2288', title: 'Juniper Market #18', subtitle: 'Resolve margin exception · Q-2288', trailing: '3h 40m', status: { label: 'Checkpoint', tone: 'checkpoint' } },
  ],
};

export const contextPanel: ContextPanelData = {
  kind: 'context',
  title: 'Northgate Grocers #4830',
  status: { label: 'Context current', tone: 'success' },
  lines: ['WO-48213 · ArcticAir WIF-3', 'Three related visits in 60 days. Evidence bundle includes four photos and a recovery log.'],
  source: 'Source: Service ERP',
  historyTitle: 'Service history',
};
