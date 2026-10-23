// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import axe from 'axe-core';
import { validDiff } from '@/contracts/fixtures/checkpoint';
import { CheckpointOverlay, CheckpointInitializing, DiffView, AccountabilityStatement, AcknowledgmentControl, ConfirmationGesture, DecisionControls } from './index';

const STATEMENT = 'I have reviewed the proposed changes shown above.';
const diffLabels = { heading: 'What will be written', targetSystem: 'Target system', record: 'Record', originatingAgent: 'Started by', now: 'Now', willBe: 'Will be', noCurrentValue: 'No value yet' };
const gestureProps = { label: 'Approve changes', armedLabel: 'Tap again to approve', armedAnnouncement: 'Armed. Tap again to approve.', disarmedAnnouncement: 'Approval was not confirmed.', processingLabel: 'Submitting your decision', windowMs: 5000 };
async function violations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}
afterEach(() => vi.useRealTimers());

describe('CheckpointOverlay', () => {
  const overlay = (children = <button type="button">Inside</button>) => (
    <CheckpointOverlay title="A decision is needed" blockingNote="The rest of your work is paused until you decide." triggeredByLabel="Started by" triggeredBy="Close-out workflow" description="Closing WO-48213 updates the record.">
      {children}
    </CheckpointOverlay>
  );
  it('is a modal dialog showing what raised it before anything else, with the blocking condition in text', () => {
    render(overlay());
    const dialog = screen.getByRole('dialog', { name: 'A decision is needed' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Closing WO-48213 updates the record.');
    expect(screen.getByText('Close-out workflow')).toBeInTheDocument();
    expect(screen.getByText('The rest of your work is paused until you decide.')).toBeInTheDocument();
  });
  it('moves focus to the container and never to a decision control', () => {
    render(overlay());
    expect(screen.getByRole('dialog')).toHaveFocus();
  });
  it('has no close, minimize or dismiss control, and Escape does nothing', () => {
    render(overlay());
    expect(screen.queryByRole('button', { name: /close|dismiss|minimi/i })).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('traps Tab inside the surface', () => {
    render(overlay(<><button type="button">First</button><button type="button">Last</button></>));
    screen.getByRole('button', { name: 'Last' }).focus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Last' }), { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(overlay());
    expect(await violations(container)).toEqual([]);
  });
});

describe('CheckpointInitializing', () => {
  it('exposes only a status message: the placeholders are hidden and inert', () => {
    const { container } = render(<CheckpointInitializing statusMessage="Preparing the changes for your review" />);
    expect(screen.getByRole('status')).toHaveTextContent('Preparing the changes for your review');
    const placeholders = container.querySelector('[aria-hidden="true"]')!;
    expect(placeholders).toHaveAttribute('inert');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('emits timeout once its supplied window elapses, and never before', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    render(<CheckpointInitializing statusMessage="Preparing" timeoutMs={3000} onTimeout={onTimeout} />);
    vi.advanceTimersByTime(2999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

describe('DiffView', () => {
  it('renders the target, record, originating agent, and the current and proposed value of every field, as labeled text', () => {
    render(<DiffView diff={validDiff} labels={diffLabels} />);
    expect(screen.getByText('Service records')).toBeInTheDocument();
    expect(screen.getByText('WO-48213')).toBeInTheDocument();
    expect(screen.getByText('Replaced the defrost sensor; recovery confirmed.')).toBeInTheDocument();
    expect(screen.getAllByText('Now')).toHaveLength(3);
    expect(screen.getAllByText('Will be')).toHaveLength(3);
    expect(screen.getByText('No value yet')).toBeInTheDocument();
  });
  it('accepts no input', () => {
    const { container } = render(<DiffView diff={validDiff} labels={diffLabels} />);
    expect(container.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0);
  });
  it('never changes after its first render: a later payload is ignored', () => {
    const { rerender } = render(<DiffView diff={validDiff} labels={diffLabels} />);
    rerender(<DiffView diff={{ ...validDiff, recordId: 'WO-99999', fields: [{ id: 'x', label: 'Other', current: 'a', proposed: 'b' }] }} labels={diffLabels} />);
    expect(screen.getByText('WO-48213')).toBeInTheDocument();
    expect(screen.queryByText('WO-99999')).toBeNull();
    expect(screen.queryByText('Other')).toBeNull();
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<DiffView diff={validDiff} labels={diffLabels} />);
    expect(await violations(container)).toEqual([]);
  });
});

describe('AccountabilityStatement', () => {
  it('renders the supplied statement in primary hierarchy, as plain text', () => {
    render(<AccountabilityStatement heading="Before you decide" statement="Approving writes the changes shown above." />);
    expect(screen.getByText('Approving writes the changes shown above.')).toBeInTheDocument();
    expect(screen.getByText('Before you decide')).toBeInTheDocument();
  });
});

describe('AcknowledgmentControl', () => {
  it('is a checkbox named by the full statement, unchecked at first', () => {
    render(<AcknowledgmentControl statement={STATEMENT} checkpointId="cp-1" acknowledged={false} onAcknowledge={() => {}} />);
    const box = screen.getByRole('checkbox', { name: STATEMENT });
    expect(box).toHaveAttribute('aria-checked', 'false');
  });
  it('emits acknowledge on activation, and is a single focusable element', () => {
    const onAcknowledge = vi.fn();
    render(<AcknowledgmentControl statement={STATEMENT} checkpointId="cp-1" acknowledged={false} onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });
  it('shows the acknowledged state as supplied, and emits nothing once acknowledged', () => {
    const onAcknowledge = vi.fn();
    render(<AcknowledgmentControl statement={STATEMENT} checkpointId="cp-1" acknowledged onAcknowledge={onAcknowledge} />);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(box);
    expect(onAcknowledge).not.toHaveBeenCalled();
  });
  it('does nothing while disabled, and exposes that', () => {
    const onAcknowledge = vi.fn();
    render(<AcknowledgmentControl statement={STATEMENT} checkpointId="cp-1" acknowledged={false} disabled onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onAcknowledge).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
  });
  it('a new checkpoint id is a new control: acknowledgment does not carry over', () => {
    const { rerender } = render(<AcknowledgmentControl statement={STATEMENT} checkpointId="cp-1" acknowledged onAcknowledge={() => {}} />);
    rerender(<AcknowledgmentControl statement={STATEMENT} checkpointId="cp-2" acknowledged={false} onAcknowledge={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox')).toHaveAttribute('data-checkpoint', 'cp-2');
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<AcknowledgmentControl statement={STATEMENT} checkpointId="cp-1" acknowledged={false} onAcknowledge={() => {}} />);
    expect(await violations(container)).toEqual([]);
  });
});

describe('ConfirmationGesture', () => {
  it('a single tap never completes: it arms, changes label, and announces', () => {
    const onComplete = vi.fn();
    render(<ConfirmationGesture {...gestureProps} enabled onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve changes' }));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tap again to approve' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Armed. Tap again to approve.');
  });
  it('the second deliberate activation completes it', () => {
    const onComplete = vi.fn();
    render(<ConfirmationGesture {...gestureProps} enabled onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Approve changes' })).toBeInTheDocument();
  });
  it('disarms and says so if the confirming action does not come inside the window', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<ConfirmationGesture {...gestureProps} enabled onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button'));
    act(() => { vi.advanceTimersByTime(5001); });
    expect(screen.getByRole('button', { name: 'Approve changes' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Approval was not confirmed.');
    fireEvent.click(screen.getByRole('button'));
    expect(onComplete).not.toHaveBeenCalled();
  });
  it('cannot be armed while approval is not enabled, and exposes that', () => {
    render(<ConfirmationGesture {...gestureProps} enabled={false} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve changes' })).toBeDisabled();
  });
  it('drops the armed state if approval stops being enabled', () => {
    const { rerender } = render(<ConfirmationGesture {...gestureProps} enabled onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    rerender(<ConfirmationGesture {...gestureProps} enabled={false} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve changes' })).toBeDisabled();
  });
});

describe('DecisionControls', () => {
  const base = { rejectLabel: 'Reject changes', approveLabel: 'Approve changes', approveArmedLabel: 'Tap again to approve', approveArmedAnnouncement: 'Armed.', approveDisarmedAnnouncement: 'Not confirmed.', processingLabel: 'Submitting', confirmWindowMs: 5000 };
  it('offers exactly two controls, approve and reject, and pre-focuses neither', () => {
    render(<DecisionControls {...base} approveEnabled deciding={null} onApproveIntent={() => {}} onReject={() => {}} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Reject changes', 'Approve changes']);
    expect(document.activeElement).toBe(document.body);
  });
  it('approve is disabled until approval is enabled, and reject is always available with a single action', () => {
    const onReject = vi.fn();
    render(<DecisionControls {...base} approveEnabled={false} deciding={null} onApproveIntent={() => {}} onReject={onReject} />);
    expect(screen.getByRole('button', { name: 'Approve changes' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reject changes' }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });
  it('emits approve-intent only after the confirmation gesture', () => {
    const onApproveIntent = vi.fn();
    render(<DecisionControls {...base} approveEnabled deciding={null} onApproveIntent={onApproveIntent} onReject={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve changes' }));
    expect(onApproveIntent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to approve' }));
    expect(onApproveIntent).toHaveBeenCalledTimes(1);
  });
  it('reject is unavailable only while the checkpoint is paused, never because of the acknowledgment', () => {
    render(<DecisionControls {...base} approveEnabled={false} rejectEnabled={false} deciding={null} onApproveIntent={() => {}} onReject={() => {}} />);
    expect(screen.getByRole('button', { name: 'Reject changes' })).toBeDisabled();
  });
  it('is inert while a decision is in flight: the other control cannot act, so there is one decision', () => {
    render(<DecisionControls {...base} approveEnabled deciding="approve" onApproveIntent={() => {}} onReject={() => {}} />);
    expect(screen.getByRole('button', { name: 'Reject changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Approve changes|Submitting/ })).toHaveAttribute('aria-busy', 'true');
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<DecisionControls {...base} approveEnabled deciding={null} onApproveIntent={() => {}} onReject={() => {}} />);
    expect(await violations(container)).toEqual([]);
  });
});
