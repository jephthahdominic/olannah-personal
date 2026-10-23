import type { ContextChannel } from '../context/contextChannel';
import { unknownVersionContext, malformedContexts } from '@/contracts/fixtures/context';
import { getFaults, getIdpPersona } from './mockIdp';
import { mockControls } from './mockControls';
import { contextFor } from './mockUsers';

export class MockContextChannel implements ContextChannel {
  #delivered = false;
  async request(): Promise<unknown> {
    const faults = getFaults();
    // Refresh controls apply only AFTER the first delivery (a refresh), so the initial boot is unaffected.
    if (this.#delivered) {
      if (mockControls.refreshDelayMs > 0) await new Promise((r) => setTimeout(r, mockControls.refreshDelayMs));
      if (mockControls.refreshFails) throw new Error('refresh failed');
    }
    if (faults.contextNeverArrives) return new Promise<never>(() => {});
    if (faults.contextDelayMs > 0) await new Promise((r) => setTimeout(r, faults.contextDelayMs));
    if (faults.schemaMismatch) return unknownVersionContext;
    if (faults.envelopeMalformed) return malformedContexts.missingLayoutConfig;
    // structuredClone so every delivery is a fresh object, like a real network payload.
    this.#delivered = true;
    return structuredClone(contextFor(getIdpPersona() ?? 'technician'));
  }
}
