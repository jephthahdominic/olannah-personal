'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { CheckpointController } from '@/runtime/checkpoint/checkpointController';
import { liveRegion } from '@/runtime/liveRegion';
import { toastStore } from '@/runtime/toasts';
import { ErrorBoundary } from '@/components/utils/ErrorBoundary';
import { messages } from '../messages';
import { CheckpointView } from './CheckpointView';
import styles from './CheckpointHost.module.css';

export interface CheckpointHostProps {
  controller: CheckpointController;
  /** The connection to the upstream, from the runtime: a loss pauses the checkpoint, a return revalidates it. */
  connection: 'connecting' | 'connected' | 'reconnecting' | 'failed' | string;
  /** Where focus goes if the element that had it before the checkpoint no longer exists. */
  fallbackFocus?: () => HTMLElement | null;
}

// Mounts the checkpoint in its own portal host on the highest layer (z-700), as a SIBLING of the canvas root, which the shell
// makes inert. The controller decides when it exists; this only renders it, announces it, relays activity and connection, and
// dismisses it. It adds no close control: the surface ends only by a decision or a terminal state.
export function CheckpointHost({ controller, connection, fallbackFocus }: CheckpointHostProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasActive = useRef(false);
  const active = state.phase !== 'idle';

  // Remember where focus was BEFORE the surface takes it. The controller notifies synchronously when it starts, ahead of React
  // rendering the overlay (whose own effect moves focus), so this reads the element the worker really had.
  useEffect(() => {
    let captured = false;
    return controller.subscribe(() => {
      const phase = controller.getState().phase;
      if (phase !== 'idle' && !captured) {
        captured = true;
        previousFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      } else if (phase === 'idle') captured = false;
    });
  }, [controller]);

  // On appearance, announce ASSERTIVELY with what raised it and why (BRD 1.3 11.4, P0).
  useEffect(() => {
    if (active && !wasActive.current && state.trigger) liveRegion.announce(messages.checkpoint.announce(state.trigger.triggeredBy, state.trigger.description), 'assertive');
    wasActive.current = active;
  }, [active, state.trigger]);

  // A terminal state: dismiss at once, tell the worker plainly what happened, and put focus back. Toasts held during the
  // checkpoint surface after it (in the order received), because the shell releases them when the controller goes idle.
  useEffect(() => {
    if (state.phase !== 'terminal' || !state.outcome) return;
    const outcome = messages.checkpoint.outcome[state.outcome];
    toastStore.push(outcome.text, outcome.tone === 'success' ? 'success' : 'info');
    controller.release();
    const target = previousFocus.current && document.contains(previousFocus.current) ? previousFocus.current : (fallbackFocus?.() ?? document.getElementById('primary-content'));
    target?.focus();
    previousFocus.current = null;
  }, [state.phase, state.outcome, controller, fallbackFocus]);

  // Connectivity: lost inside a checkpoint means paused and revalidated, never silently continued.
  useEffect(() => {
    if (!active) return;
    if (connection === 'reconnecting' || connection === 'failed') controller.connectionLost();
    else if (connection === 'connected') controller.connectionRestored();
  }, [connection, active, controller]);

  // A throttled background tab reconciles its inactivity windows from timestamps when it becomes visible again.
  useEffect(() => {
    if (!active) return;
    const onVisible = () => document.visibilityState === 'visible' && controller.checkTimers();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [active, controller]);

  if (!active || state.phase === 'terminal') return null;
  const activity = () => controller.recordActivity();
  return (
    <div className={styles.host} data-portal="checkpoint" onPointerDown={activity} onKeyDown={activity} onTouchStart={activity} onScroll={activity} onWheel={activity}>
      <ErrorBoundary
        // A render failure fails CLOSED: the checkpoint ends, nothing is submitted, and a fallback built from foundation
        // components only keeps the canvas blocked until the shell dismisses it.
        onError={() => controller.reportRenderFailure()}
        fallback={() => <div className={styles.fallback} role="status">{messages.checkpoint.outcome.render_failure.text}</div>}
      >
        <CheckpointView
          state={state}
          confirmWindowMs={controller.timings.confirmWindowMs}
          onAcknowledge={() => controller.acknowledge()}
          onApprove={() => controller.approve()}
          onReject={() => controller.reject()}
        />
      </ErrorBoundary>
    </div>
  );
}
