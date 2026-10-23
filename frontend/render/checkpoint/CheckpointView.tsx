'use client';

import { approveEnabled, type CheckpointState } from '@/runtime/checkpoint/checkpointController';
import { DegradedBanner } from '@/components';
import { AccountabilityStatement, AcknowledgmentControl, CheckpointInitializing, CheckpointOverlay, DecisionControls, DiffView } from '@/components/checkpoint';
import { messages } from '../messages';

export interface CheckpointViewProps {
  state: CheckpointState;
  /** The supplied upstream condition for approval. */
  upstreamOk?: boolean;
  confirmWindowMs: number;
  onAcknowledge: () => void;
  onApprove: () => void;
  onReject: () => void;
}

// Assembles the checkpoint card in its FIXED order (BRD 1.3 8.7): context and triggered-by (inside the overlay), the diff, the
// accountability statement, the acknowledgment, the decision controls. Nothing sits between those four. It renders controller
// state and decides nothing: approveEnabled arrives resolved, and every text is supplied from the message catalogue.
export function CheckpointView({ state, upstreamOk = true, confirmWindowMs, onAcknowledge, onApprove, onReject }: CheckpointViewProps) {
  const text = messages.checkpoint;
  const { trigger, diff } = state;
  if (!trigger) return null;
  const decisionReady = (state.phase === 'decision-ready' || state.phase === 'revalidating' || state.phase === 'submitting') && diff !== null;
  const deciding = state.phase === 'submitting' ? state.decision : null;

  return (
    <CheckpointOverlay title={text.title} blockingNote={text.blockingNote} triggeredByLabel={text.triggeredByLabel} triggeredBy={trigger.triggeredBy} description={trigger.description}>
      {state.connectionLost && <DegradedBanner message={text.connectionLost} />}
      {state.inactivityWarning && !state.connectionLost && <DegradedBanner message={text.inactivityWarning} />}
      {decisionReady ? (
        <>
          {/* Keyed by checkpoint id so a new checkpoint is always a new instance of everything below. */}
          <DiffView key={trigger.checkpointId} diff={diff} labels={text.diff} />
          <AccountabilityStatement heading={text.accountabilityHeading} statement={state.accountabilityText ?? text.accountability} />
          <AcknowledgmentControl
            statement={text.acknowledgment}
            checkpointId={trigger.checkpointId}
            acknowledged={state.acknowledgedFor === trigger.checkpointId}
            disabled={state.phase !== 'decision-ready'}
            onAcknowledge={onAcknowledge}
          />
          <DecisionControls
            rejectLabel={text.reject}
            approveLabel={text.approve}
            approveArmedLabel={text.approveArmed}
            approveArmedAnnouncement={text.approveArmedAnnouncement}
            approveDisarmedAnnouncement={text.approveDisarmed}
            processingLabel={text.submitting}
            approveEnabled={approveEnabled(state, upstreamOk) && state.phase === 'decision-ready'}
            rejectEnabled={state.phase === 'decision-ready'}
            deciding={deciding}
            confirmWindowMs={confirmWindowMs}
            onApproveIntent={onApprove}
            onReject={onReject}
          />
        </>
      ) : (
        <CheckpointInitializing statusMessage={text.initializing} />
      )}
    </CheckpointOverlay>
  );
}
