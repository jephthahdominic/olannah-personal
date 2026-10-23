// Persistence is a property of the SHELL, not of a component (BRD 1.0 SR17, BRD 1.2 5.4, SDD 7.9). A component only DECLARES
// that it is persistence-capable. The shell decides, from runtime configuration, whether a given instance actually persists.
// A component never elects itself, and the same component may be ephemeral in one composition and persisted in another.
//
// What persists is interaction CONTINUITY only: scroll position, open substate, the conversational surface. Never
// authoritative workflow, business or session state, which stay with the canvas and upstream.
export interface Continuity {
  scrollTop: number;
}

export class PersistenceManager {
  #snapshots = new Map<string, Continuity>();

  constructor(private readonly elected: readonly string[]) {}

  /** Persists only if the component is capable AND the shell elected it. */
  isElected(componentName: string, capable: boolean): boolean {
    return capable && this.elected.includes(componentName);
  }

  /** Keeps a continuity snapshot for an instance that is being released, so it can be restored without holding real data. */
  save(componentName: string, snapshot: Continuity): void {
    this.#snapshots.set(componentName, { scrollTop: Math.max(0, Math.round(snapshot.scrollTop)) });
  }

  /** Reads the snapshot without removing it. Reading during render must not change anything. */
  peek(componentName: string): Continuity | null {
    return this.#snapshots.get(componentName) ?? null;
  }

  /** Returns and removes the snapshot, if any. */
  take(componentName: string): Continuity | null {
    const s = this.#snapshots.get(componentName) ?? null;
    this.#snapshots.delete(componentName);
    return s;
  }

  clear(): void {
    this.#snapshots.clear();
  }
}
