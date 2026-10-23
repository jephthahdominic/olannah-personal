// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { useState } from 'react';
import { CheckpointController } from '@/runtime/checkpoint/checkpointController';
type CheckpointChannel = ConstructorParameters<typeof CheckpointController>[0]['channel']; // the render layer never imports a client
import { validTrigger, validDiff } from '@/contracts/fixtures/checkpoint';
import { toastStore, useToasts } from '@/runtime/toasts';
import { liveRegion } from '@/runtime/liveRegion';
import { messages } from '../messages';
import { CheckpointHost } from './CheckpointHost';
import { useBlockingScope } from './useBlockingScope';

const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); };
function make(over: Partial<CheckpointChannel> = {}) {
  const decisions: unknown[] = [];
  const channel: CheckpointChannel = {
    subscribe: () => () => {},
    fetchDiff: async () => validDiff,
    submitDecision: async (e) => { decisions.push(e); return { status: 'acknowledged' }; },
    submitAudit: async () => {},
    validate: async () => ({ checkpointId: validTrigger.checkpointId, valid: true }),
    ...over,
  };
  const states: boolean[] = [];
  const controller = new CheckpointController({ channel, session: { sessionId: 's', workerId: 'w' }, texts: { accountability: messages.checkpoint.accountability }, onActiveChange: (a) => { toastStore.setHeld(a); states.push(a); } });
  return { controller, decisions, states };
}
function Harness({ controller, connection = 'connected' }: { controller: CheckpointController; connection?: string }) {
  const [, setN] = useState(0);
  void setN;
  const blocked = controller.isActive();
  useBlockingScope(blocked);
  const toasts = useToasts();
  return (
    <>
      <div data-canvas-root>
        <button type="button">Outside</button>
      </div>
      <CheckpointHost controller={controller} connection={connection} />
      <ul aria-label="toasts">{toasts.map((t) => <li key={t.id}>{t.message}</li>)}</ul>
    </>
  );
}
const ready = async (m = make()) => {
  const view = render(<Harness controller={m.controller} />);
  act(() => { m.controller.receiveTrigger(validTrigger); });
  await flush();
  return { ...m, view };
};
afterEach(() => { toastStore.clear(); liveRegion.clear(); document.documentElement.style.overflow = ''; });

describe('CheckpointHost', () => {
  it('renders nothing until a checkpoint exists', () => {
    const { controller } = make();
    render(<Harness controller={controller} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('shows the fixed card order: context, diff, accountability, acknowledgment, decision controls', async () => {
    await ready();
    const dialog = screen.getByRole('dialog', { name: messages.checkpoint.title });
    const order = [
      within(dialog).getAllByText(validTrigger.triggeredBy)[0],
      within(dialog).getByRole('heading', { name: messages.checkpoint.diff.heading }),
      within(dialog).getByText(messages.checkpoint.accountability),
      within(dialog).getByRole('checkbox'),
      within(dialog).getByRole('button', { name: messages.checkpoint.reject }),
    ];
    for (let i = 0; i < order.length - 1; i++) expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('announces the appearance assertively, with what raised it', async () => {
    const spy = vi.spyOn(liveRegion, 'announce');
    await ready();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(validTrigger.triggeredBy), 'assertive');
  });
  it('makes the canvas root inert and locks scroll while active, and restores both when it ends', async () => {
    const { controller } = await ready();
    const root = document.querySelector('[data-canvas-root]')!;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.hasAttribute('inert') || (root as HTMLElement & { inert?: boolean }).inert === true).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    act(() => { controller.reject(); });
    await flush();
    expect(root).not.toHaveAttribute('aria-hidden');
    expect(document.documentElement.style.overflow).toBe('');
  });
  it('does not offer a close control, and Escape and Back do nothing', async () => {
    await ready();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close|dismiss/i })).toBeNull();
  });
  it('approve needs the acknowledgment and then the confirmation gesture, and sends one decision', async () => {
    const { decisions } = await ready();
    expect(screen.getByRole('button', { name: messages.checkpoint.approve })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: messages.checkpoint.approve }));
    expect(decisions).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: messages.checkpoint.approveArmed }));
    await flush();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ decision: 'approve' });
  });
  it('rejects with one action, even without acknowledgment', async () => {
    const { decisions } = await ready();
    fireEvent.click(screen.getByRole('button', { name: messages.checkpoint.reject }));
    await flush();
    expect(decisions[0]).toMatchObject({ decision: 'reject' });
  });
  it('dismisses on a terminal state and says plainly what happened, with "submitted" only when it was', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: messages.checkpoint.reject }));
    await flush();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('toasts')).toHaveTextContent(messages.checkpoint.outcome.rejected.text);
    expect(messages.checkpoint.outcome.approved.text).not.toMatch(/completed/i);
    for (const [key, o] of Object.entries(messages.checkpoint.outcome)) {
      if (key !== 'approved' && key !== 'rejected') expect(o.text, key).toMatch(/Nothing was submitted/);
    }
  });
  it('holds toasts while a checkpoint is active and surfaces them, in order, afterwards', async () => {
    const { controller } = await ready();
    act(() => { toastStore.push('First'); toastStore.push('Second'); });
    expect(screen.getByLabelText('toasts')).toBeEmptyDOMElement();
    act(() => { controller.reportRenderFailure(); });
    await flush();
    const texts = within(screen.getByLabelText('toasts')).getAllByRole('listitem').map((l) => l.textContent);
    expect(texts).toEqual(['First', 'Second', messages.checkpoint.outcome.render_failure.text]);
  });
  it('returns focus to the element that had it before the checkpoint', async () => {
    const m = make();
    render(<Harness controller={m.controller} />);
    const outside = screen.getByRole('button', { name: 'Outside' });
    outside.focus();
    act(() => { m.controller.receiveTrigger(validTrigger); });
    await flush();
    expect(screen.getByRole('dialog')).toHaveFocus();
    act(() => { m.controller.reportRenderFailure(); });
    await flush();
    expect(outside).toHaveFocus();
  });
  it('pauses on a lost connection with a plain message, and resumes with the diff intact once revalidated', async () => {
    const m = make();
    const { view } = await ready(m);
    view.rerender(<Harness controller={m.controller} connection="reconnecting" />);
    await flush();
    expect(screen.getByText(messages.checkpoint.connectionLost)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.checkpoint.reject })).toBeDisabled();
    view.rerender(<Harness controller={m.controller} connection="connected" />);
    await flush();
    expect(screen.queryByText(messages.checkpoint.connectionLost)).toBeNull();
    expect(screen.getByText('DTS-44 defrost sensor')).toBeInTheDocument();
  });
  it('fails closed on a diff that never arrives, with nothing submitted', async () => {
    vi.useFakeTimers();
    const m = make({ fetchDiff: () => new Promise(() => {}) });
    render(<Harness controller={m.controller} />);
    act(() => { m.controller.receiveTrigger(validTrigger); });
    expect(screen.getByRole('status')).toHaveTextContent(messages.checkpoint.initializing);
    expect(screen.queryByRole('checkbox')).toBeNull();
    await act(async () => { vi.advanceTimersByTime(3001); });
    vi.useRealTimers();
    await flush();
    expect(m.decisions).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(m.states).toEqual([true, false]);
  });
});
