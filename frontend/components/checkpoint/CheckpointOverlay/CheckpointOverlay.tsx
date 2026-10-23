'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { StatusIndicator } from '../../StatusIndicator/StatusIndicator';
import { Label } from '../../Label/Label';
import { useFocusTrap } from '../../utils/useFocusTrap';
import styles from './CheckpointOverlay.module.css';

export interface CheckpointOverlayProps {
  /** Supplied heading, for example "A decision is needed". */
  title: string;
  /** Supplied visible text that says the rest of the canvas is paused. The blocking condition is never shown by dimming alone. */
  blockingNote: string;
  /** What raised the checkpoint, shown BEFORE any diff (BRD 1.2 5.10). SUPPLIED. */
  triggeredByLabel: string;
  triggeredBy: string;
  description: string;
  /** The fixed card sequence: diff, accountability statement, acknowledgment, decision controls. Nothing else belongs between them. */
  children: ReactNode;
}

// The blocking surface (BRD 1.2 5.10, 1.3 7.4). It renders in the checkpoint portal host, a SIBLING of the canvas root, which
// the shell makes inert while a checkpoint is active. It offers NO close, minimize or dismiss control; Escape does nothing.
// Focus moves to the container, never to approve or reject. It is ephemeral: it is never preserved across a layout change.
export function CheckpointOverlay({ title, blockingNote, triggeredByLabel, triggeredBy, description, children }: CheckpointOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Escape is swallowed: a checkpoint is a governance boundary and ends only by a decision or a terminal state.
  const onKeyDown = useFocusTrap(root, () => {});

  useEffect(() => root.current?.focus(), []);

  return (
    <div className={styles.backdrop}>
      <div ref={root} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className={styles.card} onKeyDown={onKeyDown}>
        <header className={styles.header}>
          <StatusIndicator state="checkpoint" label="" decorative size="lg" />
          <div className={styles.headings}>
            <h2 id={titleId} className="type-heading-lg">{title}</h2>
            <p className={`${styles.note} type-body-sm`}>{blockingNote}</p>
          </div>
        </header>
        <section className={styles.context}>
          <Label text={triggeredByLabel} as="p" />
          <p className="type-data">{triggeredBy}</p>
          <p id={descriptionId} className="type-body">{description}</p>
        </section>
        {children}
      </div>
    </div>
  );
}
