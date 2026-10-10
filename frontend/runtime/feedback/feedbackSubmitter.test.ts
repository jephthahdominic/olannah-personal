import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackSubmitter } from './feedbackSubmitter';
import { clearTelemetryBuffer, getBufferedEvents } from '../telemetry';
import type { ScreenContext } from '@/contracts';

const screen: ScreenContext = { destinationId: 'dashboard', layoutId: 'technician', viewport: 'mobile', zones: [{ zone: 'primary', condition: 'rendered' }] };
beforeEach(() => clearTelemetryBuffer());

describe('FeedbackSubmitter (BRD 1.3 section 6.7, SDD ADR-004)', () => {
  it('sends validated text with the automatically captured screen context and an idempotency key', async () => {
    const submit = vi.fn(async () => true);
    const s = new FeedbackSubmitter({ submit });
    expect(await s.submit('  The next job card is wrong  ', screen)).toEqual({ ok: true });
    expect(submit).toHaveBeenCalledTimes(1);
    const sent = (submit.mock.calls[0] as unknown[])[0] as { idempotencyKey: string; text: string; screen: ScreenContext };
    expect(sent.text).toBe('The next job card is wrong');
    expect(sent.screen).toEqual(screen);
    expect(sent.idempotencyKey).toMatch(/^fb-/);
    expect(s.getSnapshot()).toBe('succeeded');
  });

  it('REUSES the same idempotency key when a failed submission is retried, so a retry can never duplicate', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(true);
    const s = new FeedbackSubmitter({ submit });
    expect((await s.submit('hello', screen)).ok).toBe(false);
    expect(s.getSnapshot()).toBe('failed');
    expect((await s.submit('hello', screen)).ok).toBe(true);
    const keys = submit.mock.calls.map((c) => (c as unknown[])[0] as { idempotencyKey: string }).map((x) => x.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });

  it('uses a NEW key for the next piece of feedback after a success', async () => {
    const submit = vi.fn(async () => true);
    const s = new FeedbackSubmitter({ submit });
    await s.submit('first', screen);
    s.reset();
    await s.submit('second', screen);
    const keys = submit.mock.calls.map((c) => ((c as unknown[])[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('ignores a second submit while one is in flight', async () => {
    let resolve!: (v: boolean) => void;
    const submit = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
    const s = new FeedbackSubmitter({ submit });
    const first = s.submit('hello', screen);
    expect(s.getSnapshot()).toBe('submitting');
    expect(await s.submit('hello again', screen)).toEqual({ ok: false, reason: 'busy' });
    resolve(true);
    await first;
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([['', 'feedback_required'], ['   ', 'feedback_required'], ['x'.repeat(2001), 'feedback_too_long'], ['bad\u0000text', 'invalid_characters']])('rejects %j as %s without sending', async (text, code) => {
    const submit = vi.fn(async () => true);
    const s = new FeedbackSubmitter({ submit });
    expect(await s.submit(text, screen)).toEqual({ ok: false, reason: 'invalid', code });
    expect(submit).not.toHaveBeenCalled();
    expect(s.getSnapshot()).toBe('idle');
  });

  it('treats an un-acknowledged submission as a failure', async () => {
    const s = new FeedbackSubmitter({ submit: async () => false });
    expect((await s.submit('hello', screen)).ok).toBe(false);
    expect(s.getSnapshot()).toBe('failed');
  });

  it('never logs the feedback text or the screen context', async () => {
    const s = new FeedbackSubmitter({ submit: async () => { throw new Error('down'); } });
    await s.submit('Very private remark about a customer', screen);
    expect(JSON.stringify(getBufferedEvents())).not.toContain('private remark');
    expect(JSON.stringify(getBufferedEvents())).not.toContain('dashboard');
  });

  it('cannot be reset mid-submission', async () => {
    let resolve!: (v: boolean) => void;
    const s = new FeedbackSubmitter({ submit: () => new Promise<boolean>((r) => (resolve = r)) });
    const p = s.submit('hello', screen);
    s.reset();
    expect(s.getSnapshot()).toBe('submitting');
    resolve(true);
    await p;
  });
});
