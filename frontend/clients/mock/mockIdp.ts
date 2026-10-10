// MOCK identity provider state. This is the ONE module allowed to touch browser storage (see eslint.config.mjs).
// It stands in for the SSO cookie: after a reload the real flow re-enters SSO and a session confirmation arrives
// again (SDD 5.5), so the mock keeps "the IdP is still signed in" in sessionStorage. The session TOKEN is never
// stored; only which mock persona is signed in. Compiled out of real mode (see clients/upstream.ts).

export type MockPersona = 'technician' | 'estimator' | 'multirole' | 'unmapped' | 'norole';

export interface MockFaults {
  /** Session confirmation never arrives: the loading screen must hold, not crash (BRD 1.0 UR1C). */
  sessionNeverArrives: boolean;
  /** Delay before the context object is delivered. 900 exercises the degraded state, >hard timeout the recovery screen. */
  contextDelayMs: number;
  contextNeverArrives: boolean;
  /** Deliver a context object with an unrecognized schema version. */
  schemaMismatch: boolean;
  /** Deliver a structurally malformed global envelope. */
  envelopeMalformed: boolean;
  /** Expire the session this long after confirmation. null = never. */
  sessionExpiresAfterMs: number | null;
}

export const NO_FAULTS: MockFaults = {
  sessionNeverArrives: false,
  contextDelayMs: 0,
  contextNeverArrives: false,
  schemaMismatch: false,
  envelopeMalformed: false,
  sessionExpiresAfterMs: null,
};

const SESSION_KEY = 'olannah.mock.idp.persona';
const FAULTS_KEY = 'olannah.mock.faults';

const store = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

export function getIdpPersona(): MockPersona | null {
  return (store()?.getItem(SESSION_KEY) as MockPersona | null) ?? null;
}

export function setIdpPersona(persona: MockPersona): void {
  store()?.setItem(SESSION_KEY, persona);
}

export function clearIdpSession(): void {
  store()?.removeItem(SESSION_KEY);
}

export function getFaults(): MockFaults {
  try {
    const raw = store()?.getItem(FAULTS_KEY);
    return raw ? { ...NO_FAULTS, ...(JSON.parse(raw) as Partial<MockFaults>) } : NO_FAULTS;
  } catch {
    return NO_FAULTS;
  }
}

export function setFaults(faults: Partial<MockFaults>): void {
  store()?.setItem(FAULTS_KEY, JSON.stringify({ ...getFaults(), ...faults }));
}
