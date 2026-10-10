'use client';

import { useSyncExternalStore } from 'react';
import type { AssistantSession, AssistantState } from './assistantSession';

const INITIAL: AssistantState = { turns: [], status: 'connecting', unread: 0 };

export function useAssistant(session: AssistantSession): AssistantState {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, () => INITIAL);
}
