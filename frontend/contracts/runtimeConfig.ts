import { z } from 'zod';

// Runtime tunables served as /runtime-config.json (ADR-012, SDD Appendix D). Never contains secrets.
// Changing a value needs no code deployment. A missing or invalid file falls back to compiled defaults.
export const RuntimeConfigSchema = z.object({
  session: z.object({
    // When the loading message changes to the "taking longer than expected" text. PROPOSED, agree with Product.
    slowMessageAfterMs: z.number().int().positive(),
    // How long the session-expired screen shows before routing to SSO.
    expiredRedirectMs: z.number().int().nonnegative(),
  }),
  refresh: z.object({
    // BRD 1.0 UR6D: refresh every 5 minutes regardless of events (provisional).
    autoIntervalMs: z.number().int().positive(),
    // BRD 1.0 UR7B: the indicator becomes a warning after 30 seconds (provisional).
    stalenessWarnMs: z.number().int().positive(),
  }),
  bus: z.object({
    // The bus owns the real heartbeat (OPEN, 1.0 OQ4). Silence for twice this long is treated as a disconnect.
    heartbeatMs: z.number().int().positive(),
    // SDD 12.4: 1s, 2s, 4s, 8s with jitter, capped at 30s.
    backoffMs: z.array(z.number().int().positive()).min(1),
    maxBackoffMs: z.number().int().positive(),
    // Escalate to the reconnection-failed banner after 3 attempts or 30 seconds, whichever comes first.
    failAfterAttempts: z.number().int().positive(),
    failAfterMs: z.number().int().positive(),
  }),
  persistence: z.object({
    // The shell, never a component, decides which persistence-capable instances survive a layout change (BRD 1.0 SR17).
    // Only these canonical names may be elected. WorkflowStepper joins when it exists.
    elected: z.array(z.string()),
  }),
  toast: z.object({
    // BRD 1.2 5.8 Feature 8: transient confirmations auto-dismiss after 7 seconds by default.
    durationMs: z.number().int().positive(),
  }),
  support: z.object({
    // PLACEHOLDER: no support contact has been supplied. Product must provide the real destination.
    contactHref: z.string().min(1),
  }),
  context: z.object({
    // BRD 1.0 PT2: PCR delivery budget.
    deliveryBudgetMs: z.number().int().positive(),
    // PROPOSED default 10,000ms (SDD Q26). Product must confirm.
    hardTimeoutMs: z.number().int().positive(),
  }),
});
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  session: { slowMessageAfterMs: 3000, expiredRedirectMs: 2000 },
  refresh: { autoIntervalMs: 300000, stalenessWarnMs: 30000 },
  bus: { heartbeatMs: 15000, backoffMs: [1000, 2000, 4000, 8000], maxBackoffMs: 30000, failAfterAttempts: 3, failAfterMs: 30000 },
  persistence: { elected: ['AssistantPanel'] },
  toast: { durationMs: 7000 },
  support: { contactHref: 'mailto:support@olannah.invalid' },
  context: { deliveryBudgetMs: 800, hardTimeoutMs: 10000 },
};
