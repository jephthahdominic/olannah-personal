"use client"

import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './WorkflowStepper.module.css';

export type StepCompletion = 'complete' | 'incomplete';

export interface WorkflowStep {
  id: string;
  label: string;
  /** SUPPLIED completion. The stepper never derives completion from data (BRD 1.2 5.6 Prohibited). */
  completion: StepCompletion;
  /** SUPPLIED visible status text, for example "Done" or "Not started". Completion is never color alone. */
  statusLabel: string;
  /** Supplied detail shown when the step is expanded. */
  detail?: string;
  /** Supplied outcome-named label for the request to move this step forward, for example "Complete safety pre-check". */
  advanceLabel?: string;
}

export interface WorkflowContinuity {
  expandedId: string | null;
}

export interface WorkflowStepperProps {
  /** Ordered steps, rendered in the order supplied. Empty renders nothing: the composing layer chooses an EmptyState. */
  steps: readonly WorkflowStep[];
  /** SUPPLIED, never computed: which step is the current one. */
  activeStepId: string | null;
  ariaLabel: string;
  /** `step-select`: the worker asked to look at a step. */
  onSelect?: (id: string) => void;
  /** `step-advance`: the worker asked to move a step forward. The stepper advances and completes nothing itself: the canvas
   *  decides, and any write routes through the checkpoint (BRD 1.2 5.6 Prohibited). */
  onAdvance?: (id: string) => void;
  /** Presentation continuity (which step was open), handed in and out by the shell's persistence manager. This component
   *  is persistence-CAPABLE only: the shell decides whether it persists, and nothing here is workflow progress (BRD 1.2 5.4). */
  initialContinuity?: WorkflowContinuity;
  onContinuity?: (c: WorkflowContinuity) => void;
}

// Ordered workflow steps with completion state and the active step for a guided workflow (BRD 1.2 5.6).
export function WorkflowStepper({ steps, activeStepId, ariaLabel, onSelect, onAdvance, initialContinuity, onContinuity }: WorkflowStepperProps) {
  const [expandedId, setExpandedId] = useState<string | null>(initialContinuity?.expandedId ?? activeStepId);
  const latest = useRef(expandedId);
  const report = useRef(onContinuity);
  // Keep the latest values for the release callback below. Refs are written after render, never during it.
  useEffect(() => {
    latest.current = expandedId;
    report.current = onContinuity;
  });
  // Report presentation continuity when the instance is released, so the shell may keep it across a layout change.
  useEffect(() => () => report.current?.({ expandedId: latest.current }), []);

  return (
    <ol className={styles.list} aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const current = step.id === activeStepId;
        const open = step.id === expandedId;
        const bodyId = `step-${step.id}-body`;
        return (
          <li key={step.id} className={styles.item} data-current={current || undefined} data-complete={step.completion === 'complete' || undefined}>
            <button
              type="button"
              className={styles.header}
              aria-expanded={open}
              aria-controls={bodyId}
              aria-current={current ? 'step' : undefined}
              onClick={() => {
                setExpandedId(open ? null : step.id);
                onSelect?.(step.id);
              }}
            >
              <span className={styles.marker} aria-hidden="true">
                {step.completion === 'complete' ? <Icon name="check" size="sm" /> : <span className="type-caption">{index + 1}</span>}
              </span>
              <span className={styles.title}>
                <span className="type-heading-sm">{step.label}</span>
                <span className={`${styles.status} type-caption`}>{step.statusLabel}</span>
              </span>
              <Icon name={open ? 'chevron-down' : 'chevron-right'} size="md" />
            </button>
            <div id={bodyId} className={styles.body} hidden={!open}>
              {step.detail && <p className={`${styles.detail} type-body-sm`}>{step.detail}</p>}
              {current && step.advanceLabel && onAdvance && <Button label={step.advanceLabel} onActivate={() => onAdvance(step.id)} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
