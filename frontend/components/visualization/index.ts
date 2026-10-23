// The visualization group is its own entry point so it can be code-split into a lazy "charts chunk": technician phones never
// download it (SDD 13.2). Import from '@/components/visualization', not from the main library index.
export { ProgressRing, type ProgressRingProps } from './ProgressRing';
export { SLAIndicator, type SLAIndicatorProps } from './SLAIndicator';
export { BarChart, type BarChartProps } from './BarChart';
export { LineChart, type LineChartProps } from './LineChart';
export { DonutChart, type DonutChartProps, type DonutSegment } from './DonutChart';
export type { ChartSeries, ChartStatus } from './vizShared';
import { MAX_SERIES } from './vizShared';
/** The most series any chart will draw. Beyond this a table is shown instead (BRD 1.3 section 10.5). */
export const maxChartSeries = MAX_SERIES;
