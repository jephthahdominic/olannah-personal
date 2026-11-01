import { messages } from '../messages';
import type { LayoutTemplate, ZoneSpec } from './types';

// Persona layout templates. They are data: a template says which zones exist, where they sit at each breakpoint, and which component
// renders each. A new persona adds a template here (and registers any new components); orchestration code never changes (BRD SR19).
//
// A zone's id is the id the context object gives it ('alerts', 'work_order', 'steps', 'actions', 'history'), so the zone store key and
// the zone spec are the same thing. Every zone carries its own unavailable and empty text (BRD UR5A: no text, no ship).

const m = messages.zones;
const zone = (id: string, role: ZoneSpec['role'], content: string, text: { title: string; unavailable: { title: string; body: string }; empty: { title: string; body: string } }): ZoneSpec => ({
  id,
  title: text.title,
  role,
  surface: role === 'primary' ? 'card' : 'panel',
  content: [content],
  unavailable: { ...text.unavailable, retry: true },
  empty: text.empty,
});

// Alerts, steps and actions have no container of their own: their items are the cards, and the current step is the focal one. The work order and the history
// are supporting information on a panel (BRD 1.3 section 7.2: a zone's surface follows its structural role, not its content).
const plain = (z: ZoneSpec): ZoneSpec => ({ ...z, surface: 'workspace' });
const alerts = plain(zone('alerts', 'primary', 'AlertsContent', m.alerts));
const workOrder = zone('work_order', 'context', 'WorkOrderContent', m.workOrder);
const steps = { ...plain(zone('steps', 'primary', 'StepsContent', m.steps)), persistence: 'persistence-capable-host' as const };
const actions = plain(zone('actions', 'primary', 'ActionsContent', m.actions));
// Service history is supporting information that informs the task without being the task (BRD 1.3 section 7), so it is the context zone.
const history: ZoneSpec = { ...zone('history', 'context', 'HistoryContent', m.history), collapsesOn: 'mobile' };

// The Dashboard is a screen of its own: a greeting, the counts, the next job and the schedule. Its content carries its own heading and its own
// refresh and freshness indicators, so the host adds neither.
const dashboard: ZoneSpec = { ...plain(zone('dashboard', 'primary', 'DashboardContent', m.dashboard)), showTitle: false, selfIndicates: true };

// Work Orders is a screen of its own too: a heading, the assigned jobs grouped by day, and a way to ask for more. Its content carries its heading.
const workOrders: ZoneSpec = { ...plain(zone('work_orders', 'primary', 'WorkOrdersContent', m.workOrders)), showTitle: false, staleMarker: false };

function standard(id: string): LayoutTemplate {
  return {
    id,
    schemaVersion: '1.0',
    zones: [alerts, workOrder, steps, actions, history],
    dashboard,
    workOrders,
    placements: {
      // Primary content is always fully visible. Context is the first thing to collapse.
      // On a phone everything about the job is in one column, and history is the part that folds away. From tablet up the job (alerts,
      // steps, actions) is the main column, and the supporting information (work order, history) sits beside it.
      mobile: [
        { zoneId: 'alerts', region: 'main' },
        { zoneId: 'steps', region: 'main' },
        { zoneId: 'actions', region: 'main' },
        { zoneId: 'work_order', region: 'main' },
        { zoneId: 'history', region: 'collapsible' },
      ],
      tablet: [
        { zoneId: 'alerts', region: 'main' },
        { zoneId: 'steps', region: 'main' },
        { zoneId: 'actions', region: 'main' },
        { zoneId: 'work_order', region: 'aside' },
        { zoneId: 'history', region: 'aside' },
      ],
      desktop: [
        { zoneId: 'alerts', region: 'main' },
        { zoneId: 'steps', region: 'main' },
        { zoneId: 'actions', region: 'main' },
        { zoneId: 'work_order', region: 'aside' },
        { zoneId: 'history', region: 'aside' },
      ],
    },
  };
}

export const TEMPLATES: Readonly<Record<string, LayoutTemplate>> = {
  technician: standard('technician'),
  estimator: standard('estimator'),
  // The platform default layout, used for a role that is known but has no registered layout (BRD 1.0 UR3C).
  default: standard('default'),
};

export function getTemplate(layoutId: string): LayoutTemplate {
  return TEMPLATES[layoutId] ?? TEMPLATES.default;
}
