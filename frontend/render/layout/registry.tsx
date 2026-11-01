'use client';

import type { ComponentType } from 'react';
import type { ZoneState } from '@/runtime/zones/zoneStore';
import { DashboardContent } from '../dashboard/DashboardContent';
import { WorkOrdersContent } from '../workorders/WorkOrdersContent';
import { ActionsContent } from '../zones/ActionsContent';
import { AlertsContent } from '../zones/AlertsContent';
import { HistoryContent } from '../zones/HistoryContent';
import { StepsContent } from '../zones/StepsContent';
import { WorkOrderContent } from '../zones/WorkOrderContent';
import type { ZoneSpec } from './types';

// The component registry maps a canonical name to its implementation (SDD 6.6). Templates reference components by name;
// the build test fails if a template names an unregistered component.
export interface ZoneContentProps {
  zone: ZoneSpec;
  state: ZoneState;
}

// Zone data was validated when it was ingested (unknown shapes never reach here). Content is only ever what the zone delivered:
// never invented (BRD 1.2 5.2 Feature 1C).
export const componentRegistry: Readonly<Record<string, ComponentType<ZoneContentProps>>> = {
  DashboardContent,
  WorkOrdersContent,
  AlertsContent,
  WorkOrderContent,
  StepsContent,
  ActionsContent,
  HistoryContent,
};

export function resolveComponent(name: string): ComponentType<ZoneContentProps> | null {
  return componentRegistry[name] ?? null;
}
