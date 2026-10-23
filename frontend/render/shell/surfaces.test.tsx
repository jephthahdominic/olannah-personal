// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const nav = vi.hoisted(() => ({ pathname: '/' }));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => nav.pathname }));

import { Shell } from './Shell';
import { makeRuntime, type RuntimeHarness } from '@/tests/shellFixtures';
import { resetNavigationMemory } from '../navigation/navigationMemory';
import { toastStore } from '@/runtime/toasts';
import { liveRegion } from '@/runtime/liveRegion';
import { clearTelemetryBuffer, getBufferedEvents } from '@/runtime/telemetry';
import { technicianContext } from '@/contracts/fixtures/context';
import { technicianDashboard } from '@/contracts/fixtures/zones';
import { messages } from '../messages';

const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
const ui = (h: RuntimeHarness) => <Shell context={technicianContext} layout={{ layoutId: 'technician', unmappedRole: false }} runtime={h.runtime} signOut={() => {}} supportHref="mailto:help@example.test" />;
function mount(over: Parameters<typeof makeRuntime>[1] = {}) {
  const h = makeRuntime(technicianContext, over);
  const utils = render(ui(h));
  return { ...h, ...utils, remount: () => utils.rerender(ui(h)) };
}
const start = async (h: RuntimeHarness) =>
  act(async () => {
    h.runtime.start();
    h.latest().open();
    h.assistant().open();
  });
const turn = (id: string, extra: Record<string, unknown> = {}) => ({ type: 'message', turn: { id, role: 'assistant', text: `Hello ${id}`, ...extra } });
const trigger = () => screen.getByRole('button', { name: /^Ask Olannah/ });
const dashboardEvent = (widgets: unknown[]) => ({ type: 'zone.update', zoneId: 'primary:dashboard', payload: { status: 'ready', data: { ...technicianDashboard, widgets } } });

beforeEach(() => {
  setWidth(1280);
  nav.pathname = '/';
  push.mockClear();
  resetNavigationMemory();
  toastStore.clear();
  liveRegion.clear();
  clearTelemetryBuffer();
});
afterEach(() => {
  vi.useRealTimers();
  setWidth(1024);
});

describe('Assistant: a secondary surface (BRD 1.3 sections 6.6 and 7.1)', () => {
  it('is closed by default on desktop: only the floating trigger shows, and the widget output leads', () => {
    mount();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
  });

  it('opens from the trigger as a dialog that does NOT sit inside the primary content, and displaces nothing', () => {
    mount();
    fireEvent.click(trigger());
    const dialog = screen.getByRole('dialog', { name: messages.assistant.title });
    expect(screen.getByRole('main').contains(dialog)).toBe(false);
    expect(document.querySelector('[data-portal="drawer"]')!.contains(dialog)).toBe(true);
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('closes with Escape and returns focus to the trigger', () => {
    mount();
    trigger().focus();
    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('on mobile has no floating trigger: it opens as a bottom sheet from More, which then closes', () => {
    setWidth(375);
    mount();
    expect(screen.queryByRole('button', { name: /^Ask Olannah/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Ask Olannah/ }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog', { name: messages.assistant.title })).toHaveAttribute('aria-modal', 'true');
  });
});

describe('Assistant: conversation over the WebSocket', () => {
  it('shows an assistant reply that arrives, and sends the worker\'s own words out, clearing the draft only when they left', async () => {
    const h = mount();
    await start(h);
    fireEvent.click(trigger());
    await act(async () => void h.assistant().emit(turn('1')));
    expect(within(screen.getByRole('log')).getByText('Hello 1')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(messages.assistant.inputLabel), { target: { value: 'Last visit here?' } });
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.assistant.send })));
    expect(JSON.parse(h.assistant().outbound[0])).toMatchObject({ type: 'user_message', text: 'Last visit here?' });
    expect(screen.getByLabelText(messages.assistant.inputLabel)).toHaveValue('');
    expect(within(screen.getByRole('log')).getByText('Last visit here?')).toBeInTheDocument();
  });

  it('when the connection drops, shows it, disables sending, and keeps what was typed instead of pretending it was sent', async () => {
    const h = mount();
    await start(h);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByLabelText(messages.assistant.inputLabel), { target: { value: 'Still here' } });
    await act(async () => void h.assistant().fail());
    expect(screen.getByText(messages.assistant.reconnecting)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.assistant.send })).toBeDisabled();
    expect(screen.getByLabelText(messages.assistant.inputLabel)).toHaveValue('Still here');
    expect(h.assistant().outbound).toEqual([]);
  });

  it('a PROACTIVE message while closed puts the unread count in the trigger name; opening clears it', async () => {
    const h = mount();
    await start(h);
    await act(async () => void h.assistant().emit(turn('p1', { proactive: true })));
    expect(screen.getByRole('button', { name: messages.assistant.unreadTrigger(1) })).toBeInTheDocument();
    fireEvent.click(trigger());
    await act(async () => void (await Promise.resolve()));
    expect(screen.getByText(messages.assistant.proactive)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: messages.assistant.trigger })).toBeInTheDocument();
  });

  it('a proactive message never opens the panel by itself or interrupts the worker', async () => {
    const h = mount();
    await start(h);
    await act(async () => void h.assistant().emit(turn('p1', { proactive: true })));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Persistence is a SHELL decision, not the component\'s (BRD 1.0 SR17, BRD 1.2 5.4)', () => {
  it('an ELECTED assistant stays open as the worker navigates to another destination', () => {
    const h = mount({ persistenceElected: ['AssistantPanel'] });
    fireEvent.click(trigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    nav.pathname = '/work-orders';
    h.remount();
    expect(screen.getByRole('dialog', { name: messages.assistant.title })).toBeInTheDocument();
  });

  it('the SAME component, with the shell electing nothing, is released when the worker navigates away', () => {
    const h = mount({ persistenceElected: [] });
    fireEvent.click(trigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    nav.pathname = '/work-orders';
    h.remount();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an elected instance keeps its typed draft across navigation; an ephemeral one does not', () => {
    const elected = mount({ persistenceElected: ['AssistantPanel'] });
    fireEvent.click(trigger());
    fireEvent.change(screen.getByLabelText(messages.assistant.inputLabel), { target: { value: 'half a thought' } });
    nav.pathname = '/assets';
    elected.remount();
    expect(screen.getByLabelText(messages.assistant.inputLabel)).toHaveValue('half a thought');
    elected.unmount();

    nav.pathname = '/';
    const ephemeral = mount({ persistenceElected: [] });
    fireEvent.click(trigger());
    fireEvent.change(screen.getByLabelText(messages.assistant.inputLabel), { target: { value: 'half a thought' } });
    nav.pathname = '/assets';
    ephemeral.remount();
    fireEvent.click(trigger());
    expect(screen.getByLabelText(messages.assistant.inputLabel)).toHaveValue('');
  });

  it('the conversation itself is never held by the component: it comes from the runtime cache and clears with the session', async () => {
    const h = mount();
    await start(h);
    await act(async () => void h.assistant().emit(turn('1')));
    h.runtime.assistant.dispose();
    expect(h.runtime.assistant.getSnapshot().turns).toEqual([]);
  });
});

describe('Feedback (BRD 1.3 section 6.7)', () => {
  it('is a small text link in the topbar on tablet and desktop, and not in the topbar on mobile', () => {
    const { unmount } = mount();
    expect(within(screen.getByRole('banner')).getByRole('button', { name: messages.feedback.link })).toBeInTheDocument();
    unmount();
    setWidth(375);
    mount();
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: messages.feedback.link })).toBeNull();
  });

  it('on mobile opens from More as a bottom sheet', () => {
    setWidth(375);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Feedback/ }));
    expect(screen.getByRole('dialog', { name: messages.feedback.title })).toHaveAttribute('aria-modal', 'true');
  });

  it('shows the current screen automatically and never asks the worker to describe it', () => {
    mount();
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: messages.feedback.link }));
    expect(screen.getByText('Dashboard, desktop view')).toBeInTheDocument();
  });

  it('validates before sending: empty text shows a plain message and sends nothing', async () => {
    const h = mount();
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: messages.feedback.link }));
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.feedback.submit })));
    expect(screen.getByText(messages.feedback.validation.feedback_required)).toBeInTheDocument();
    expect(h.feedbackSubmit).not.toHaveBeenCalled();
  });

  it('sends the text with the AUTOMATICALLY captured structured screen context (names and conditions, never values)', async () => {
    const h = mount();
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: messages.feedback.link }));
    fireEvent.change(screen.getByLabelText(messages.feedback.fieldLabel), { target: { value: '  The next job time looks wrong  ' } });
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.feedback.submit })));
    expect(h.feedbackSubmit).toHaveBeenCalledTimes(1);
    const sent = (h.feedbackSubmit.mock.calls[0] as unknown[])[0] as { text: string; idempotencyKey: string; screen: { destinationId: string; layoutId: string; viewport: string; zones: { zone: string; condition: string }[] } };
    expect(sent.text).toBe('The next job time looks wrong');
    expect(sent.screen).toMatchObject({ destinationId: 'dashboard', layoutId: 'technician', viewport: 'desktop' });
    expect(sent.screen.zones.map((z) => z.zone)).toEqual(['primary:dashboard', 'context']);
    expect(JSON.stringify(sent.screen)).not.toMatch(/Northgate|Marcus|WO-48213/); // no screen content is captured
    expect(sent.idempotencyKey).toMatch(/^fb-/);
    expect(await screen.findByText(messages.feedback.doneTitle)).toBeInTheDocument();
  });

  it('a failed send keeps the text and the retry REUSES the same idempotency key, so it can never duplicate', async () => {
    let calls = 0;
    const h = mount({ feedback: async () => (++calls === 1 ? Promise.reject(new Error('timeout')) : true) });
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: messages.feedback.link }));
    fireEvent.change(screen.getByLabelText(messages.feedback.fieldLabel), { target: { value: 'Please fix' } });
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.feedback.submit })));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(messages.feedback.failedTitle);
    expect(screen.getByLabelText(messages.feedback.fieldLabel)).toHaveValue('Please fix');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.feedback.retry })));
    const keys = h.feedbackSubmit.mock.calls.map((c) => ((c as unknown[])[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('keeps an unsent draft if the form is dismissed, and starts blank after a successful send', async () => {
    mount();
    const open = () => fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: messages.feedback.link }));
    open();
    fireEvent.change(screen.getByLabelText(messages.feedback.fieldLabel), { target: { value: 'unsent thought' } });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    open();
    expect(screen.getByLabelText(messages.feedback.fieldLabel)).toHaveValue('unsent thought');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.feedback.submit })));
    await screen.findByText(messages.feedback.doneTitle);
    fireEvent.click(screen.getByRole('button', { name: messages.feedback.doneClose }));
    open();
    expect(screen.getByLabelText(messages.feedback.fieldLabel)).toHaveValue('');
  });

  it('never logs the feedback text', async () => {
    mount();
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: messages.feedback.link }));
    fireEvent.change(screen.getByLabelText(messages.feedback.fieldLabel), { target: { value: 'Private remark about a customer' } });
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: messages.feedback.submit })));
    await screen.findByText(messages.feedback.doneTitle);
    expect(JSON.stringify(getBufferedEvents())).not.toContain('Private remark');
    expect(getBufferedEvents().map((e) => e.event)).toContain('feedback.submitted');
  });
});

describe('Insight widgets on the Dashboard (BRD 1.2 5.11)', () => {
  it('renders the supplied insight through the container, display-only', () => {
    mount();
    expect(screen.getByText('Bring a defrost control kit')).toBeInTheDocument();
    expect(screen.getByText('Evidence-backed')).toBeInTheDocument();
    expect(screen.getByText(messages.widget.headerLabel)).toBeInTheDocument();
  });

  it.each([
    ['an unsupported newer version', { type: 'insight', schemaVersion: '9.9', payload: { title: 'x', body: 'y' } }, 'widget.unsupported'],
    ['an unknown type', { type: 'hologram', schemaVersion: '1.0', payload: {} }, 'widget.unsupported'],
    ['an invalid payload', { type: 'insight', schemaVersion: '1.0', payload: { title: 42 } }, 'widget.invalid'],
  ])('shows the safe fallback for %s, logs the real reason, and leaves the rest of the Dashboard working', async (_n, widget, event) => {
    const h = mount();
    await start(h);
    await act(async () => void h.latest().send(dashboardEvent([widget])));
    expect(screen.getByText(messages.widget.fallbackTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.widget.fallbackMessage)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Marcus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open work order' })).toBeInTheDocument();
    expect(getBufferedEvents().map((e) => e.event)).toContain(event);
    expect(document.body.textContent).not.toMatch(/9\.9|hologram/);
  });

  it('shows a degraded insight only when degradation was supplied', async () => {
    const h = mount();
    await start(h);
    await act(async () => void h.latest().send(dashboardEvent([{ type: 'insight', schemaVersion: '1.0', condition: 'degraded', degradedMessage: 'Built from partial service history.', payload: { title: 'Likely defrost fault', body: 'Matches repeated door-open events.' } }])));
    expect(screen.getByText('Built from partial service history.')).toBeInTheDocument();
    expect(screen.getByText('Likely defrost fault')).toBeInTheDocument();
  });
});
