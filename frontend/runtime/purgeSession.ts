// purgeSession() is the ONLY code path for ending a session (SDD 5.6). Logout, expiry and revocation-to-login all
// call it. Subsystems register a cleanup handler when they start, so closing the bus, cancelling timers, clearing
// stores and dropping the in-memory token stay in one place and nothing from the session survives in the browser.

type PurgeHandler = () => void | Promise<void>;

const handlers = new Set<PurgeHandler>();

export function registerPurgeHandler(handler: PurgeHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export async function purgeSession(): Promise<void> {
  // One failing handler must never stop the rest from clearing session data.
  for (const handler of [...handlers]) {
    try {
      await handler();
    } catch {
      // Intentionally swallowed: purge continues. Handlers log their own failures.
    }
  }
}
