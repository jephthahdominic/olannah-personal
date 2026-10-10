'use client';

import { useEffect, useMemo, useState } from 'react';
import { AssistantPanel } from '@/components';
import { useAssistant } from '@/runtime/assistant/useAssistant';
import type { CanvasRuntime } from '@/runtime/canvas/canvasRuntime';
import { messages } from '../messages';

// The composing layer for the assistant (BRD 1.2 5.10): it owns the draft, relays the worker's words to the runtime's
// assistant session, and supplies the connection state. The panel itself calls nothing. The assistant is a SECONDARY surface:
// it is closed by default and never occupies primary zone space.
export function AssistantHost({
  runtime,
  open,
  onOpen,
  onClose,
  presentation,
  showTrigger,
  portalTarget,
}: {
  runtime: CanvasRuntime;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  presentation: 'floating' | 'sheet';
  showTrigger: boolean;
  portalTarget: HTMLElement | null;
}) {
  const state = useAssistant(runtime.assistant);
  const [draft, setDraft] = useState('');
  const [submitError, setSubmitError] = useState<string | undefined>();

  // Whether this instance persists is decided by the SHELL's configuration, never by the component (BRD 1.0 SR17).
  const persists = runtime.persistence.isElected('AssistantPanel', true);

  // Tell the session whether the panel is open, so a proactive message is only "unread" while it is closed.
  useEffect(() => {
    runtime.assistant.setOpen(open);
  }, [runtime, open]);

  const initialScrollTop = useMemo(() => (open && persists ? (runtime.persistence.peek('AssistantPanel')?.scrollTop ?? 0) : 0), [open, persists, runtime]);

  const connection = state.status === 'connected' ? 'connected' : state.status === 'failed' ? 'disconnected' : 'reconnecting';
  const data = state.turns.length > 0 ? 'ready' : state.status === 'connecting' ? 'loading' : 'empty';

  return (
    <AssistantPanel
      open={open}
      presentation={presentation}
      showTrigger={showTrigger}
      turns={state.turns}
      data={data}
      connection={connection}
      unread={state.unread}
      draft={draft}
      onDraftChange={(d) => {
        setDraft(d);
        setSubmitError(undefined);
      }}
      onSubmit={(text) => {
        const result = runtime.assistant.submit(text);
        // The draft is cleared ONLY when the message actually left. Otherwise it stays, and the panel says why.
        if (result.ok) {
          setDraft('');
          setSubmitError(undefined);
        } else {
          setSubmitError(result.reason === 'disconnected' ? messages.assistant.notSent : messages.assistant.invalid);
        }
      }}
      onOpen={onOpen}
      onClose={onClose}
      onRetryConnection={() => runtime.assistant.retry()}
      initialScrollTop={initialScrollTop}
      onContinuity={persists ? (c) => runtime.persistence.save('AssistantPanel', c) : undefined}
      portalTarget={portalTarget}
      labels={{ ...messages.assistant, submitError }}
    />
  );
}
