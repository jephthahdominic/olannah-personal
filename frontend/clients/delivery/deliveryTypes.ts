// Types for the dev delivery module: the ONLY place that knows the practice API's URLs (backend/context_api/handoff/FRONTEND.md
// section 0). In production the PCR and the Streaming Canvas Aggregator DELIVER to the canvas; this module stands in for that
// delivery, so replacing it later changes nothing else. The shell and its components never import it.

/** The practice sessions. Any other id is a 404 (role cannot be determined). */
export type TestSessionId = 's_8f2' | 's_clear' | 's_busy' | 's_nojob' | 's_unmapped';

/** Source systems the practice server can take down, so only the zones that depend on them become unavailable. */
export type SourceSystem = 'sampro' | 'xtreme' | 'xoi' | 'sitedocs' | 'shared_drive' | 'client_portal';
/** `slow` makes that source time out. `login_wall` applies to client_portal only. */
export type SourceFaultMode = 'down' | 'slow' | 'login_wall';
export type SourceFaults = Partial<Record<SourceSystem, SourceFaultMode>>;

/** How the delivery itself can misbehave. Applied to every delivery until reset. */
export type DeliveryFault =
  /** Slow. Past 0.8 s it is flagged but still arrives. Past 10 s the server answers 504. */
  | { readonly delay_seconds: number }
  /** An unknown schema version. */
  | { readonly payload: 'bad_schema' }
  /** One broken zone: only that zone degrades. */
  | { readonly payload: 'malformed_zone' }
  /** The whole envelope broken: whole-workspace fallback. */
  | { readonly payload: 'malformed_envelope' };

/** Where the practice API is and who the dev stand-in says we are. The real session mechanism replaces the headers later. */
export interface DevDeliveryTarget {
  /** For example http://localhost:8000 */
  readonly baseUrl: string;
  /** Sent as X-Tenant-Id. The practice server accepts any value. */
  readonly tenantId: string;
  /** Which practice scenario to load. */
  readonly sessionId: TestSessionId;
}

/**
 * Dev-only switches for failing the practice server on purpose, so the canvas can be seen coping. They need the server started with
 * OLANNAH_DEV=1. Never present in a production build: the dev overlay that uses them is compiled out when the mode is not 'mock'.
 */
export interface DevFaultControls {
  setSourceFaults(faults: SourceFaults): Promise<void>;
  resetSourceFaults(): Promise<void>;
  setDeliveryFault(fault: DeliveryFault): Promise<void>;
  resetDeliveryFault(): Promise<void>;
}
