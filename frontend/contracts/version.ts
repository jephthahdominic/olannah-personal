// Supported schema versions per contract (SDD 7.4, ADR-006).
// During a migration the list holds the old and new versions so the canvas can ship before the producer cuts over.
// The canvas never guesses at an unlisted version: a render-only client cannot know whether a change is additive.
export const SUPPORTED_CONTEXT_VERSIONS = ['1.0'] as const;
export type ContextVersion = (typeof SUPPORTED_CONTEXT_VERSIONS)[number];

export function isSupportedContextVersion(v: unknown): v is ContextVersion {
  return typeof v === 'string' && (SUPPORTED_CONTEXT_VERSIONS as readonly string[]).includes(v);
}
