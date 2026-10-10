import { z } from 'zod';

// DRAFT. The assistant channel is bidirectional and proactive over a WebSocket (BRD 1.0 OQ9, resolved), so SSE alone is not
// enough. Frame formats are OPEN (SDD K6, BRD 1.2 OQ7). The canvas holds a render-only cache of turns and never treats them
// as authoritative.
export const AssistantTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1).max(8000),
  // True when the assistant spoke first, from live worker activity, rather than answering a prompt.
  proactive: z.boolean().optional(),
});
export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;

/** Frames the canvas RECEIVES. Heartbeats are swallowed by the connection and never reach here. */
export const AssistantFrameSchema = z.object({ type: z.literal('message'), turn: AssistantTurnSchema });
export type AssistantFrame = z.infer<typeof AssistantFrameSchema>;

/** The frame the canvas SENDS. The text is the worker's own words, validated before it leaves the browser. */
export const OutboundMessageSchema = z.object({
  type: z.literal('user_message'),
  id: z.string().min(1),
  text: z.string().trim().min(1, { error: 'message_required' }).max(2000, { error: 'message_too_long' }),
});
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;
