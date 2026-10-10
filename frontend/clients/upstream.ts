import type { AuthProvider } from './auth/authProvider';
import type { ContextChannel } from './context/contextChannel';
import type { HistoryChannel } from './history/historyChannel';
import type { SourceFactory } from './bus/busConnection';
import type { FeedbackChannel } from './feedback/feedbackChannel';
import { createRealAssistantSource } from './assistant/realAssistantSource';
import { createMockAssistantSource } from './mock/mockAssistant';
import { MockFeedbackChannel } from './mock/mockFeedbackChannel';
import { RealFeedbackChannel } from './real/realFeedbackChannel';
import { createRealBusSource } from './bus/realBusSource';
import { createMockBusSource } from './mock/mockBus';
import { MockHistoryChannel } from './mock/mockHistoryChannel';
import { RealHistoryChannel } from './real/realHistoryChannel';
import { MockAuthProvider } from './mock/mockAuthProvider';
import { MockContextChannel } from './mock/mockContextChannel';
import { RealAuthProvider } from './real/realAuthProvider';
import { RealContextChannel } from './real/realContextChannel';

// The backend is not ready, so mock mode is the default. Set NEXT_PUBLIC_UPSTREAM_MODE=real to use real providers.
// A production deployment must set it explicitly; the mock fault-injection UI is hidden when mode is not 'mock'.
export type UpstreamMode = 'mock' | 'real';

export const upstreamMode: UpstreamMode = process.env.NEXT_PUBLIC_UPSTREAM_MODE === 'real' ? 'real' : 'mock';

export interface Upstream {
  auth: AuthProvider;
  context: ContextChannel;
  history: HistoryChannel;
  createBusSource: SourceFactory;
  /** The assistant is bidirectional and proactive, so it is a WebSocket alongside SSE (BRD 1.0 OQ9). */
  createAssistantSource: SourceFactory;
  feedback: FeedbackChannel;
}

let instance: Upstream | null = null;

export function getUpstream(): Upstream {
  instance ??=
    upstreamMode === 'mock'
      ? { auth: new MockAuthProvider(), context: new MockContextChannel(), history: new MockHistoryChannel(), createBusSource: createMockBusSource, createAssistantSource: createMockAssistantSource, feedback: new MockFeedbackChannel() }
      : { auth: new RealAuthProvider(), context: new RealContextChannel(), history: new RealHistoryChannel(), createBusSource: createRealBusSource, createAssistantSource: createRealAssistantSource, feedback: new RealFeedbackChannel() };
  return instance;
}
