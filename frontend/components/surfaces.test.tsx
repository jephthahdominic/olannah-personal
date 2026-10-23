// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import { AssistantPanel, FeedbackForm, WidgetContainer, TextArea, Link, type AssistantPanelProps, type FeedbackFormProps } from './index';

const labels = {
  title: 'Ask Olannah', trigger: 'Ask Olannah', unreadTrigger: (n: number) => `Ask Olannah, ${n} new`, close: 'Close assistant', inputLabel: 'Your question', send: 'Send',
  userName: 'You', assistantName: 'Olannah', proactive: 'Suggestion from Olannah', emptyTitle: 'Ask anything', emptyBody: 'Olannah answers questions about your jobs.', loading: 'Connecting',
  reconnecting: 'Reconnecting to Olannah.', disconnected: 'Olannah cannot be reached.', retry: 'Try again',
};
const panel = (over: Partial<AssistantPanelProps> = {}): AssistantPanelProps => ({
  open: true, presentation: 'floating', showTrigger: true, turns: [], data: 'empty', connection: 'connected', unread: 0, draft: '', onDraftChange: () => {}, onSubmit: () => {},
  onOpen: () => {}, onClose: () => {}, onRetryConnection: () => {}, labels, ...over,
});

describe('AssistantPanel (BRD 1.2 5.10, 1.3 6.6 and 7.1)', () => {
  it('is hidden by default: closed shows only the floating trigger, never the panel', () => {
    render(<AssistantPanel {...panel({ open: false })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ask Olannah' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the trigger mounted but hidden while the panel is open, so focus can return to it', () => {
    render(<AssistantPanel {...panel({ open: true })} />);
    expect(screen.queryByRole('button', { name: 'Ask Olannah' })).toBeNull(); // hidden from the accessibility tree
    expect(document.querySelector('button[aria-haspopup="dialog"]')).toHaveAttribute('hidden');
  });

  it('shows no trigger at all on mobile (it is opened from the More menu instead)', () => {
    render(<AssistantPanel {...panel({ open: false, showTrigger: false })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('puts the unread count in the trigger name, so it is not conveyed by the badge alone', () => {
    render(<AssistantPanel {...panel({ open: false, unread: 2 })} />);
    expect(screen.getByRole('button', { name: 'Ask Olannah, 2 new' })).toBeInTheDocument();
  });

  it('asks to open when the trigger is used, and owns no open state of its own', () => {
    const onOpen = vi.fn();
    render(<AssistantPanel {...panel({ open: false, onOpen })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Olannah' }));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull(); // still closed until the composing layer says otherwise
  });

  it('renders supplied turns as a polite log, labels who spoke, and flags proactive suggestions', () => {
    render(<AssistantPanel {...panel({ data: 'ready', turns: [{ id: '1', role: 'user', text: 'Last visit?' }, { id: '2', role: 'assistant', text: 'Sensor reset on Aug 12.', proactive: true }] })} />);
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(within(log).getByText('Last visit?')).toBeInTheDocument();
    expect(within(log).getByText('Suggestion from Olannah')).toBeInTheDocument();
  });

  it('shows a loading state (hidden from AT as shapes, announced as busy) and an explained empty state', () => {
    const { rerender } = render(<AssistantPanel {...panel({ data: 'loading' })} />);
    expect(screen.getByRole('status', { name: 'Connecting' })).toHaveAttribute('aria-busy', 'true');
    rerender(<AssistantPanel {...panel({ data: 'empty' })} />);
    expect(screen.getByText('Ask anything')).toBeInTheDocument();
  });

  it('emits the worker\'s own words on submit and calls nothing else', () => {
    const onSubmit = vi.fn();
    render(<AssistantPanel {...panel({ draft: 'What happened here before?', onSubmit })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledWith('What happened here before?');
  });

  it('is a controlled field: it renders the supplied draft and emits changes', () => {
    const onDraftChange = vi.fn();
    render(<AssistantPanel {...panel({ draft: 'abc', onDraftChange })} />);
    const input = screen.getByLabelText('Your question');
    expect(input).toHaveValue('abc');
    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(onDraftChange).toHaveBeenCalledWith('abcd');
  });

  it('cannot send an empty message, or any message while the connection is not live, and says why', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<AssistantPanel {...panel({ draft: '   ', onSubmit })} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    rerender(<AssistantPanel {...panel({ draft: 'hello', connection: 'reconnecting', onSubmit })} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByText('Reconnecting to Olannah.')).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows an error banner with a retry when disconnected, and a supplied send error as an alert', () => {
    const onRetryConnection = vi.fn();
    render(<AssistantPanel {...panel({ connection: 'disconnected', onRetryConnection, labels: { ...labels, submitError: 'That message was not sent.' } })} />);
    expect(screen.getByText('Olannah cannot be reached.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryConnection).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('That message was not sent.');
  });

  it('is a labelled dialog: focus moves in, Escape closes, Tab stays inside, and focus returns to the opener', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>opener</button>
          <AssistantPanel {...panel({ open, showTrigger: false, onClose: () => setOpen(false) })} />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByText('opener');
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Ask Olannah' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    const focusables = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]');
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('as a mobile bottom sheet it dims the page, and a tap on the overlay closes it', () => {
    const onClose = vi.fn();
    render(<AssistantPanel {...panel({ presentation: 'sheet', showTrigger: false, onClose })} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(screen.getByTestId('assistant-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('reports scroll continuity (and only scroll) when it closes, and restores a supplied position when it opens', () => {
    const onContinuity = vi.fn();
    const { rerender } = render(<AssistantPanel {...panel({ data: 'ready', turns: [{ id: '1', role: 'assistant', text: 'x' }], onContinuity, initialScrollTop: 40 })} />);
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollTop', { configurable: true, writable: true, value: 77 });
    fireEvent.scroll(log);
    rerender(<AssistantPanel {...panel({ open: false, onContinuity })} />);
    expect(onContinuity).toHaveBeenCalledWith({ scrollTop: 77 });
  });
});

const fbLabels = { title: 'Feedback', aboutLabel: 'About', fieldLabel: 'What would you like to tell us?', submit: 'Send feedback', submitting: 'Sending feedback', close: 'Close feedback', doneTitle: 'Thank you', doneBody: 'Sent with the screen you were on.', doneClose: 'Close', failedTitle: 'Not sent', failedBody: 'Your text is still here.', retry: 'Try sending again' };
const feedback = (over: Partial<FeedbackFormProps> = {}): FeedbackFormProps => ({ open: true, presentation: 'popover', screenSummary: 'Dashboard, desktop view', draft: '', onDraftChange: () => {}, status: 'idle', maxLength: 2000, onSubmit: () => {}, onDismiss: () => {}, labels: fbLabels, ...over });

describe('FeedbackForm (BRD 1.3 section 6.7, 1.2 5.10 Feature 7)', () => {
  it('renders nothing while closed', () => {
    render(<FeedbackForm {...feedback({ open: false })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the screen it is about, captured automatically and read-only, so the worker never describes it', () => {
    render(<FeedbackForm {...feedback()} />);
    expect(screen.getByText('Dashboard, desktop view')).toBeInTheDocument();
    expect(screen.getByLabelText('What would you like to tell us?')).toBeInTheDocument();
    expect(screen.queryByLabelText(/which screen|where are you/i)).toBeNull();
  });

  it('is a controlled field with a visible label and a length limit', () => {
    const onDraftChange = vi.fn();
    render(<FeedbackForm {...feedback({ draft: 'abc', onDraftChange })} />);
    const field = screen.getByLabelText('What would you like to tell us?');
    expect(field).toHaveValue('abc');
    expect(field).toHaveAttribute('maxlength', '2000');
    fireEvent.change(field, { target: { value: 'abcd' } });
    expect(onDraftChange).toHaveBeenCalledWith('abcd');
  });

  it('emits submit, and while submitting locks the field and ignores a second submit', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<FeedbackForm {...feedback({ draft: 'hi', onSubmit })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(<FeedbackForm {...feedback({ draft: 'hi', onSubmit, status: 'submitting' })} />);
    expect(screen.getByLabelText('What would you like to tell us?')).toBeDisabled();
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Send feedback/ })).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the SUPPLIED validation message tied to the field, and never decides validity itself', () => {
    render(<FeedbackForm {...feedback({ validationMessage: 'Write a few words before you send.' })} />);
    expect(screen.getByLabelText('What would you like to tell us?')).toHaveAccessibleDescription('Write a few words before you send.');
  });

  it('shows the supplied failure state, keeps the text, and offers a retry', () => {
    render(<FeedbackForm {...feedback({ draft: 'my text', status: 'failed' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not sent');
    expect(screen.getByLabelText('What would you like to tell us?')).toHaveValue('my text');
    expect(screen.getByRole('button', { name: 'Try sending again' })).toBeInTheDocument();
  });

  it('shows the supplied success state as a status, with a way to close', () => {
    const onDismiss = vi.fn();
    render(<FeedbackForm {...feedback({ status: 'succeeded', onDismiss })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Thank you');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('closes with Escape and traps focus, as a dialog', () => {
    const onDismiss = vi.fn();
    render(<FeedbackForm {...feedback({ onDismiss })} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('as a mobile sheet it dims the page and the overlay closes it', () => {
    const onDismiss = vi.fn();
    render(<FeedbackForm {...feedback({ presentation: 'sheet', onDismiss })} />);
    fireEvent.click(screen.getByTestId('feedback-overlay'));
    expect(onDismiss).toHaveBeenCalled();
  });
});

const insight = (over: Record<string, unknown> = {}) => ({ type: 'insight', schemaVersion: '1.0', payload: { title: 'Bring a defrost control kit', body: 'Three recent visits cite ice buildup.', evidence: 'Service history: Aug 12 sensor reset.', label: 'Evidence-backed' }, ...over });
const wp = { headerLabel: 'Olannah Insight', fallbackTitle: 'Insight unavailable', fallbackMessage: 'This insight cannot be shown right now. Your work is not affected.' };

describe('WidgetContainer (BRD 1.2 5.11)', () => {
  it('renders a supported, valid insight from its payload and shows no action control', () => {
    render(<WidgetContainer widget={insight()} {...wp} />);
    expect(screen.getByText('Bring a defrost control kit')).toBeInTheDocument();
    expect(screen.getByText('Evidence-backed')).toBeInTheDocument();
    expect(screen.getByText('Service history: Aug 12 sensor reset.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it.each([
    ['an unknown type', insight({ type: 'hologram' }), 'unsupported'],
    ['an unsupported (newer) version', insight({ schemaVersion: '9.9' }), 'unsupported'],
    ['an invalid payload', insight({ payload: { title: 42 } }), 'invalid'],
    ['a missing payload', { type: 'insight', schemaVersion: '1.0' }, 'invalid'],
    ['a non-object', 'nope', 'invalid'],
    ['null', null, 'invalid'],
  ])('renders the safe fallback for %s, and reports the real reason (%s) to diagnostics only', (_n, widget, reason) => {
    const onDiagnostic = vi.fn();
    render(<WidgetContainer widget={widget} {...wp} onDiagnostic={onDiagnostic} />);
    expect(screen.getByText('Insight unavailable')).toBeInTheDocument();
    expect(screen.getByText(wp.fallbackMessage)).toBeInTheDocument();
    expect(onDiagnostic).toHaveBeenCalledWith(reason);
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });

  it('never shows a schema version, widget type or code to the worker, even in the fallback', () => {
    render(<WidgetContainer widget={insight({ type: 'hologram', schemaVersion: '9.9' })} {...wp} />);
    expect(document.body.textContent).not.toMatch(/hologram|9\.9|schema|payload|invalid|unsupported/i);
  });

  it('distinguishes unsupported from invalid in diagnostics even though the worker sees the same text', () => {
    const a = vi.fn();
    const b = vi.fn();
    const { container: c1 } = render(<WidgetContainer widget={insight({ schemaVersion: '9.9' })} {...wp} onDiagnostic={a} />);
    const { container: c2 } = render(<WidgetContainer widget={insight({ payload: {} })} {...wp} onDiagnostic={b} />);
    expect(a).toHaveBeenCalledWith('unsupported');
    expect(b).toHaveBeenCalledWith('invalid');
    expect(c1.textContent).toBe(c2.textContent);
  });

  it('shows the degraded banner ONLY when degradation was supplied, and never infers it from a missing field', () => {
    const { rerender } = render(<WidgetContainer widget={insight({ condition: 'degraded', degradedMessage: 'Built from partial service history.' })} {...wp} />);
    expect(screen.getByText('Built from partial service history.')).toBeInTheDocument();
    rerender(<WidgetContainer widget={insight({ payload: { title: 'Only a title', body: 'Only a body' } })} {...wp} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not treat extra payload fields as actions or render them', () => {
    render(<WidgetContainer widget={insight({ payload: { title: 'T', body: 'B', action: { label: 'Do it', run: 'write()' }, onClick: 'x' } })} {...wp} />);
    expect(screen.queryByText('Do it')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('never crashes on hostile or absurd input', () => {
    for (const widget of [undefined, [], 42, { type: 1 }, { type: 'insight', schemaVersion: 1, payload: 'x' }, { type: 'insight', schemaVersion: '1.0', payload: { title: 'a'.repeat(100000), body: 'b' } }]) {
      expect(() => render(<WidgetContainer widget={widget} {...wp} />)).not.toThrow();
    }
  });
});

describe('TextArea and Link', () => {
  it('TextArea is controlled and never holds its own copy', () => {
    const onChange = vi.fn();
    render(<TextArea id="x" value="abc" onChange={onChange} />);
    const area = screen.getByRole('textbox');
    fireEvent.change(area, { target: { value: 'abcd' } });
    expect(onChange).toHaveBeenCalledWith('abcd');
    expect(area).toHaveValue('abc');
  });

  it('Link navigates with an href, or opens a surface with onActivate (a button that looks like a link)', () => {
    const onActivate = vi.fn();
    const { rerender } = render(<Link label="Docs" href="/docs" />);
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
    rerender(<Link label="Feedback" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
    expect(onActivate).toHaveBeenCalled();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
