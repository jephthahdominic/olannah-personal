import type { Category } from '@/components/manifests';

// The seven component categories of BRD 1.2 5.1. A component's primary category decides which state contract applies.
export interface GroupInfo {
  id: Category;
  label: string;
  summary: string;
}

export const GROUPS: readonly GroupInfo[] = [
  { id: 'foundation', label: 'Foundation', summary: 'Primitives every screen is built from: containers, headings, labels, icons, buttons and links.' },
  { id: 'data-display', label: 'Data display', summary: 'Render values the canvas supplies. They show data; they never derive it.' },
  { id: 'input-control', label: 'Input and control', summary: 'Capture what the worker enters and emit it upward. The composing layer owns the value.' },
  { id: 'feedback-status', label: 'Feedback and status', summary: 'Tell the worker the state of the system: loading, empty, degraded, failed or confirmed.' },
  { id: 'visualization', label: 'Visualization', summary: 'Charts and indicators for operational data. Built when the estimator screens are taken up.' },
  { id: 'system-surface', label: 'System surface', summary: 'Assembled surfaces for a system purpose: navigation, the assistant, feedback and the checkpoint.' },
  { id: 'widget', label: 'Widget', summary: 'The single container that renders AI insight output, display-only.' },
];

export const groupLabel = (id: Category) => GROUPS.find((g) => g.id === id)?.label ?? id;
