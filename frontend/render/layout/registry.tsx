'use client';

import type { ComponentType } from 'react';
import type { ContextPanelData, DashboardData } from '@/contracts';
import type { ZoneState } from '@/runtime/zones/zoneStore';
import { ContextPanel } from '../dashboard/ContextPanel';
import { DashboardContent } from '../dashboard/DashboardContent';
import type { ZoneSpec } from './types';

// The component registry maps a canonical name to its implementation (SDD 6.6). Templates reference components by name;
// the build test fails if a template names an unregistered component.
export interface ZoneContentProps {
  zone: ZoneSpec;
  state: ZoneState;
}

// Zone data was validated when it was ingested (unknown shapes never reach here), so a kind check is enough to narrow it.
function DestinationContent({ state }: ZoneContentProps) {
  const data = state.data as { kind?: string } | undefined;
  // Content is only ever what the zone delivered: never invented (BRD 1.2 5.2 Feature 1C).
  return data?.kind === 'dashboard' ? <DashboardContent data={data as DashboardData} /> : null;
}

function ContextContent({ state }: ZoneContentProps) {
  const data = state.data as { kind?: string } | undefined;
  return data?.kind === 'context' ? <ContextPanel data={data as ContextPanelData} /> : null;
}

export const componentRegistry: Readonly<Record<string, ComponentType<ZoneContentProps>>> = {
  DestinationContent,
  ContextContent,
};

export function resolveComponent(name: string): ComponentType<ZoneContentProps> | null {
  return componentRegistry[name] ?? null;
}
