'use client';

import type { Wire } from '@/contracts';
import { WorkflowStepper, type WorkflowStep } from '@/components';
import type { ZoneContentProps } from '../layout/registry';
import { messages } from '../messages';

// The steps zone: Step[] into the WorkflowStepper. Completion and the current step are the SUPPLIED `status`; the canvas finds the step
// that says "current" and derives no completion of its own. The stepper never advances a step: writes are not defined yet (BRD OQ13)
// and would route through the checkpoint, so no advance control is offered.
export function StepsContent({ state }: ZoneContentProps) {
  const steps = (state.data ?? []) as readonly Wire.Step[];
  const m = messages.zones.steps;
  const view: WorkflowStep[] = steps.map((step) => ({
    id: step.id,
    label: step.label,
    completion: step.status === 'done' ? 'complete' : 'incomplete',
    statusLabel: m.status[step.status],
    detail: `${m.kind[step.kind]} · ${step.required ? m.required : m.optional}`,
  }));
  const current = steps.find((step) => step.status === 'current');
  return <WorkflowStepper steps={view} activeStepId={current?.id ?? null} ariaLabel={m.ariaLabel} />;
}
