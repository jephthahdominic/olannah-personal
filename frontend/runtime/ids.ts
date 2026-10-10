// A client-generated unique identifier, for idempotency keys and message ids. Not a secret and not security-sensitive.
export function newId(prefix = 'id'): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  const uuid = c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}
