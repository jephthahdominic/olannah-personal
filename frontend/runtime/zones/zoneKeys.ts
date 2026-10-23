// Zone store keys. The primary zone shows a different payload per destination, so its key carries the destination
// identifier ("primary:dashboard"). The context zone has one key.
export const CONTEXT_ZONE = 'context';
const PRIMARY_PREFIX = 'primary:';

export const primaryZoneKey = (destinationId: string | null): string => `${PRIMARY_PREFIX}${destinationId ?? 'dashboard'}`;

/** Only well-formed zone keys are accepted from the bus. Anything else is a global envelope failure. */
export function isKnownZoneKey(key: string): boolean {
  return key === CONTEXT_ZONE || /^primary:[a-z][a-z0-9-]*$/.test(key);
}
