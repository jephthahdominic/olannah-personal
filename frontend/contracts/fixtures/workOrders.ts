import type { Wire } from '..';

// The PROPOSED work orders zone (PROPOSED_DASHBOARD_ZONE.md), as the approved design "04 Work Orders" needs it. It is NOT delivered by the practice
// API yet: mock mode attaches it so the design can be built and seen. Raw JSON-shaped data, written the way the backend would send it.
//
// The first row is the practice API's own active work order (WO-4471), and the references match the Dashboard's schedule, so the two screens
// never disagree about the same job. The other jobs are made up.

export type WorkOrdersVariant = 'assigned' | 'empty';

const AS_OF = '2026-10-23T08:00:03-05:00';

const row = (id: string, time_local: string, title: string, task: string, address: string, status: Wire.DashboardStatus | null = null): Wire.WorkOrderRow => ({ id, time_local, title, status, task, address });

const today: Wire.WorkOrdersGroup = {
  id: 'today',
  heading: 'Today',
  more: null,
  items: [
    row('WO-4471', '08:00', 'Northfield Grocers, Store 118', 'Compressor fault - walk-in cooler temp alarm', '118 Harbor Avenue', { label: 'Urgent', tone: 'warning' }),
    row('WO-5102', '13:15', 'Union Coffee Roasters', 'Preventive maintenance', '740 Pine Street', { label: 'Late', tone: 'error' }),
    row('WO-5108', '14:00', 'Valley Cold Storage', 'Freezer bank maintenance', '9 Industrial Road'),
    row('WO-5110', '15:40', 'Beacon Hotel', 'Ice maker inspection', '15 Lakeshore Drive'),
    row('WO-5113', '16:30', 'Riverside Pharmacy', 'Vaccine fridge alarm', '88 River Road'),
    row('WO-5116', '17:15', 'Northgate Grocers #4810', 'Display case lighting', '410 Main Street'),
    row('WO-5119', '18:00', 'Westfield Arena', 'Rooftop unit filter change', '1 Arena Way'),
  ],
};

const tomorrowFirst: Wire.WorkOrderRow[] = [
  row('WO-5121', '08:00', 'Brandon Medical Office', 'Boiler not firing on stage 2', '1500 Victoria Avenue'),
  row('WO-5124', '09:30', 'Prairie Co-op', 'Rooftop unit short cycling', '41 Main Street West'),
  row('WO-5126', '11:00', 'Lakeside School', 'Boiler inspection', '220 School Lane'),
  row('WO-5127', '12:00', 'Beacon Hotel', 'Ice maker repair', '15 Lakeshore Drive'),
];

// The seven that arrive when the worker asks for more.
const tomorrowRest: Wire.WorkOrderRow[] = [
  row('WO-5130', '12:45', 'Harbor View Hotel', 'Walk-in cooler door gasket', '3 Pier Road'),
  row('WO-5133', '13:30', 'Maple Street Bakery', 'Proofer not holding temperature', '27 Maple Street'),
  row('WO-5135', '14:15', 'Central Library', 'Chiller noise', '600 Central Avenue'),
  row('WO-5138', '15:00', 'Oakridge Care Home', 'Rooftop unit inspection', '12 Oakridge Court'),
  row('WO-5140', '15:45', 'Fairview Mall', 'Cooling tower fan', '1 Fairview Plaza'),
  row('WO-5143', '16:30', 'Greenfield Market', 'Display case defrost', '90 Greenfield Road'),
  row('WO-5146', '17:15', 'Lakeshore Diner', 'Ice machine service', '8 Lakeshore Drive'),
];

const tomorrow = (expanded: boolean): Wire.WorkOrdersGroup => ({
  id: 'tomorrow',
  heading: 'Tomorrow',
  items: expanded ? [...tomorrowFirst, ...tomorrowRest] : tomorrowFirst,
  more: expanded ? null : { caption: 'Showing 4 of 11 jobs', action_label: 'Show 7 more jobs' },
});

/**
 * The work orders zone as it would be delivered. `expanded` is what arrives after the worker asks for more of tomorrow's jobs: all eleven, and
 * nothing more to ask for. A fresh object every call.
 */
export function workOrdersZone(variant: WorkOrdersVariant = 'assigned', expanded = false): { state: 'rendered'; as_of: string; data: Wire.WorkOrdersData } {
  const data: Wire.WorkOrdersData = variant === 'empty' ? { heading: 'Work orders', groups: [] } : { heading: 'Work orders', groups: [today, tomorrow(expanded)] };
  return { state: 'rendered', as_of: AS_OF, data: structuredClone(data) };
}

/** A raw context with the work orders zone added. */
export function withWorkOrders<T extends { zones: Record<string, unknown> }>(context: T, variant: WorkOrdersVariant = 'assigned'): T {
  return { ...context, zones: { ...context.zones, work_orders: workOrdersZone(variant) } };
}
