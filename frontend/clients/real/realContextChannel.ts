import type { ContextChannel } from '../context/contextChannel';

// Placeholder: transport is OPEN (SDD K2). Rejecting leaves the boot machine in its waiting states, which end at the
// degraded and recovery screens exactly as a real outage would.
export class RealContextChannel implements ContextChannel {
  async request(): Promise<unknown> {
    throw new Error('context transport not implemented');
  }
}
