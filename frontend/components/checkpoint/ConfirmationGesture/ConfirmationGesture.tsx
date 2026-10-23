'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../../Button/Button';
import { StatusIndicator } from '../../StatusIndicator/StatusIndicator';

export interface ConfirmationGestureProps {
  /** The approve label, outcome-named, for example "Approve changes". */
  label: string;
  /** The label while armed, for example "Tap again to approve". Supplied. */
  armedLabel: string;
  /** Supplied, announced politely when the gesture is armed and when it times out. */
  armedAnnouncement: string;
  disarmedAnnouncement: string;
  /** Supplied by the canvas. The gesture does not decide that approval is valid. */
  enabled: boolean;
  /** The approval was submitted and is awaiting its acknowledgment. */
  processing?: boolean;
  processingLabel: string;
  /** How long the armed state waits for the confirming action. Supplied (a configurable window). */
  windowMs: number;
  /** `gesture-complete`: emitted only by the SECOND deliberate action. A single tap never emits it. */
  onComplete: () => void;
}

// The deliberate second interaction before approval (BRD 1.2 5.10 Feature 2). First activation ARMS the control: its label
// and shape change, it announces, and it waits. A second activation inside the window completes the gesture. Leaving it alone
// disarms it. It works the same for pointer, touch and keyboard, and adds no third control. It never applies to rejection.
export function ConfirmationGesture({ label, armedLabel, armedAnnouncement, disarmedAnnouncement, enabled, processing = false, processingLabel, windowMs, onComplete }: ConfirmationGestureProps) {
  const [armed, setArmed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef<number | null>(null);

  const disarm = (announce: boolean) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
    if (announce) setAnnouncement(disarmedAnnouncement);
  };

  // If approval stops being possible, or the decision is in flight, the armed state is dropped.
  useEffect(() => {
    if (armed && (!enabled || processing)) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a prop change that invalidates the armed state
      setArmed(false);
    }
  }, [enabled, processing, armed]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  return (
    <>
      <Button
        label={armed ? armedLabel : label}
        variant="primary"
        disabled={!enabled}
        processing={processing}
        processingLabel={processingLabel}
        fullWidth
        leading={armed ? <StatusIndicator state="checkpoint" label="" decorative size="sm" /> : undefined}
        onActivate={() => {
          if (!armed) {
            setArmed(true);
            setAnnouncement(armedAnnouncement);
            timer.current = window.setTimeout(() => disarm(true), windowMs);
            return;
          }
          disarm(false);
          onComplete();
        }}
      />
      <span className="visually-hidden" role="status">{announcement}</span>
    </>
  );
}
