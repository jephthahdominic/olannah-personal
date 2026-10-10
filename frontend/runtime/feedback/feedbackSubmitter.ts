import { feedbackTextSchema, type FeedbackErrorCode, type ScreenContext } from '@/contracts';
import type { FeedbackChannel } from '@/clients/feedback/feedbackChannel';
import { newId } from '../ids';
import { logEvent } from '../telemetry';

// Submits contextual feedback (BRD 1.3 section 6.7). The idempotency key is generated ONCE per attempt and REUSED on retry,
// so a retry after a timeout can never create a duplicate record (SDD ADR-004). The submitter decides nothing about success
// beyond the acknowledgment it receives: the form renders the state it is given (BRD 1.2 5.10 Feature 7).
export type FeedbackStatus = 'idle' | 'submitting' | 'succeeded' | 'failed';
export type FeedbackResult = { ok: true } | { ok: false; reason: 'invalid'; code: FeedbackErrorCode } | { ok: false; reason: 'busy' | 'failed' };

export class FeedbackSubmitter {
  #status: FeedbackStatus = 'idle';
  #listeners = new Set<() => void>();
  #key: string | null = null;

  constructor(private readonly channel: FeedbackChannel) {}

  subscribe = (l: () => void): (() => void) => {
    this.#listeners.add(l);
    return () => this.#listeners.delete(l);
  };
  getSnapshot = (): FeedbackStatus => this.#status;

  async submit(text: string, screen: ScreenContext): Promise<FeedbackResult> {
    if (this.#status === 'submitting') return { ok: false, reason: 'busy' };
    const parsed = feedbackTextSchema.safeParse(text);
    if (!parsed.success) return { ok: false, reason: 'invalid', code: parsed.error.issues[0].message as FeedbackErrorCode };

    this.#key ??= newId('fb'); // reused on retry, cleared only on success or reset
    this.#set('submitting');
    try {
      const acknowledged = await this.channel.submit({ idempotencyKey: this.#key, text: parsed.data, screen });
      if (!acknowledged) throw new Error('not acknowledged');
      this.#key = null;
      logEvent('feedback.submitted', 'info');
      this.#set('succeeded');
      return { ok: true };
    } catch {
      // Never log the text, the key or the screen context.
      logEvent('feedback.failed', 'warn', 'network');
      this.#set('failed');
      return { ok: false, reason: 'failed' };
    }
  }

  /** Back to a blank form (a new draft gets a new key). */
  reset(): void {
    if (this.#status === 'submitting') return;
    this.#key = null;
    this.#set('idle');
  }

  #set(next: FeedbackStatus): void {
    this.#status = next;
    for (const l of [...this.#listeners]) l();
  }
}
