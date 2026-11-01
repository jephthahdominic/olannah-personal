import type { AuthProvider } from './auth/authProvider';
import type { ContextChannel } from './context/contextChannel';
import type { HistoryChannel } from './history/historyChannel';
import type { SourceFactory } from './bus/busConnection';
import type { FeedbackChannel } from './feedback/feedbackChannel';
import type { CheckpointChannel } from './checkpoint/checkpointChannel';
import { MockCheckpointChannel } from './mock/mockCheckpointChannel';
import { RealCheckpointChannel } from './real/realCheckpointChannel';
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
import { DEFAULT_DELIVERY_TARGET, DevContextChannel, DevFaultClient, DevHistoryChannel } from './delivery/devDelivery';
import type { DevFaultControls } from './delivery/deliveryTypes';

// The backend is not ready, so mock mode is the default. Set NEXT_PUBLIC_UPSTREAM_MODE to choose:
//   mock      everything is in-browser and fake. The default.
//   practice  context and history come from the practice Context API (Kelechi's backend, made-up data) through the dev delivery
//             module. Sign-in, the bus, the assistant, feedback and checkpoints are still mocked, because the API has none of them.
//   real      real providers. Not all of them exist yet.
// A production deployment must set it explicitly. The fault-injection UI shows in 'mock' and 'practice' only.
export type UpstreamMode = 'mock' | 'practice' | 'real';

const requestedMode = process.env.NEXT_PUBLIC_UPSTREAM_MODE;
export const upstreamMode: UpstreamMode = requestedMode === 'real' || requestedMode === 'practice' ? requestedMode : 'mock';
/** True when the dev tools (mock panel, dev overlay) may be shown. Never true in a real build. */
export const devToolsEnabled = upstreamMode !== 'real';

/** Where the practice API is. Set at build time. The browser may only call an origin the CSP allows (see next.config.ts). */
export const practiceTarget = { ...DEFAULT_DELIVERY_TARGET, baseUrl: process.env.NEXT_PUBLIC_PRACTICE_API_URL || DEFAULT_DELIVERY_TARGET.baseUrl };

export interface Upstream {
  auth: AuthProvider;
  context: ContextChannel;
  history: HistoryChannel;
  createBusSource: SourceFactory;
  /** The assistant is bidirectional and proactive, so it is a WebSocket alongside SSE (BRD 1.0 OQ9). */
  createAssistantSource: SourceFactory;
  feedback: FeedbackChannel;
  checkpoint: CheckpointChannel;
  /** Switches that fail the practice server on purpose. Only in practice mode. */
  devFaults?: DevFaultControls;
  /** Which practice scenario is delivered. Only in practice mode. */
  practice?: { setSession: DevContextChannel['setSession']; getSession: () => string };
}

let instance: Upstream | null = null;

function practiceUpstream(): Upstream {
  // One context channel and one history channel share the same target, so switching scenario switches both.
  const context = new DevContextChannel({ target: practiceTarget });
  const history = new DevHistoryChannel({ target: practiceTarget });
  const setSession: DevContextChannel['setSession'] = (id) => {
    context.setSession(id);
    history.setSession(id);
  };
  return {
    auth: new MockAuthProvider(),
    context,
    history,
    createBusSource: createMockBusSource,
    createAssistantSource: createMockAssistantSource,
    feedback: new MockFeedbackChannel(),
    checkpoint: new MockCheckpointChannel(),
    devFaults: new DevFaultClient({ target: practiceTarget }),
    practice: { setSession, getSession: () => context.sessionId },
  };
}

export function getUpstream(): Upstream {
  if (upstreamMode === 'practice') return (instance ??= practiceUpstream());
  instance ??=
    upstreamMode === 'mock'
      ? { auth: new MockAuthProvider(), context: new MockContextChannel(), history: new MockHistoryChannel(), createBusSource: createMockBusSource, createAssistantSource: createMockAssistantSource, feedback: new MockFeedbackChannel(), checkpoint: new MockCheckpointChannel() }
      : { auth: new RealAuthProvider(), context: new RealContextChannel(), history: new RealHistoryChannel(), createBusSource: createRealBusSource, createAssistantSource: createRealAssistantSource, feedback: new RealFeedbackChannel(), checkpoint: new RealCheckpointChannel() };
  return instance;
}
