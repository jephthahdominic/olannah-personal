'use client';

import type { Wire } from '@/contracts';
import { Button } from '@/components';
import { useConnection } from '@/runtime/canvas/useCanvasRuntime';
import { useShell } from '../layout/ShellContext';
import type { ZoneContentProps } from '../layout/registry';
import { messages } from '../messages';
import styles from './zones.module.css';

// The actions zone: Action[] as delivered. `enabled` is resolved upstream and rendered as given: the canvas adds no permission logic
// (BRD SR23C). `needs_checkpoint` is information, shown as a short note: the canvas never decides when an approval screen appears
// (Non-Goal 3). A button here only EMITS: nothing is written, because worker-initiated writes have no delivery path yet (BRD OQ13).
// While the connection is lost, write actions are visibly unavailable (BRD UR11D). The first ENABLED action, in the order supplied,
// is the emphasised one: that is a presentation choice, not a ranking.
export function ActionsContent({ state }: ZoneContentProps) {
  const actions = (state.data ?? []) as readonly Wire.Action[];
  const { runtime } = useShell();
  const connected = useConnection(runtime) === 'connected';
  const m = messages.zones.actions;
  const emphasised = actions.findIndex((a) => a.enabled);
  return (
    <ul className={styles.actions} aria-label={m.title}>
      {actions.map((action, index) => {
        const writes = action.write_back !== 'none';
        const offline = writes && !connected;
        const unavailable = !action.enabled || offline;
        const candidates: (string | null)[] = [
          !action.enabled ? m.unavailableNow : offline ? m.offline : null,
          action.write_back === 'manual' ? m.manual : action.write_back === 'none' ? m.noWriteBack : null,
          action.needs_checkpoint ? m.needsApproval : null,
        ];
        const notes = candidates.filter((note): note is string => note !== null);
        return (
          <li key={action.name} className={styles.action}>
            <Button label={action.label} variant={index === emphasised ? 'primary' : 'ghost'} fullWidth disabled={unavailable} />
            {notes.length > 0 && <p className={`${styles.muted} type-body-sm`}>{notes.join(' · ')}</p>}
          </li>
        );
      })}
    </ul>
  );
}
