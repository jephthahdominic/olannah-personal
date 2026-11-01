import type { ContextChannel } from '../context/contextChannel';
import { getFaults, getIdpPersona } from './mockIdp';
import { mockControls } from './mockControls';
import { workOrdersZone } from '@/contracts/fixtures/workOrders';
import { badSchemaContext, malformedEnvelopeContext, malformedZoneContext, mockContextFor } from './mockContexts';

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
    if (faults.schemaMismatch) return badSchemaContext();
    if (faults.envelopeMalformed) return malformedEnvelopeContext();
    if (faults.zoneMalformed) return malformedZoneContext();
    this.#delivered = true;
    return mockContextFor(getIdpPersona() ?? 'technician', faults.scenario, faults.dashboard, faults.workOrders);
  }

  /** The worker asked for more of one group. The practice API has no such call, so mock mode answers with the whole list, all eleven jobs. */
  async requestMore(zoneId: string): Promise<unknown> {
    await new Promise((r) => setTimeout(r, 700));
    if (mockControls.moreFails || zoneId !== 'work_orders') throw new Error('could not load more');
    return workOrdersZone('assigned', true);
  }
}
