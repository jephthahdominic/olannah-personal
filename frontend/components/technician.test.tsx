// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import axe from 'axe-core';
import { DetailRow, ChoiceGroup, NumberInput, LookupField, WorkflowStepper, PhotoCapture, FormField, type WorkflowStep } from './index';

async function violations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

describe('DetailRow', () => {
  it('renders a supplied label and value, and a supplied status without deriving it', () => {
    render(<DetailRow label="Equipment" value="ArcticAir WIF-3" status={{ label: 'Approved', tone: 'success' }} />);
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('ArcticAir WIF-3')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
  it('renders an empty value, not a placeholder, when the value is absent', () => {
    const { container } = render(<DetailRow label="Contact" />);
    expect(container.textContent).toBe('Contact');
  });
  it('uses the multi-column layout only when asked', () => {
    const { container, rerender } = render(<DetailRow label="A" value="B" />);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/multi/);
    rerender(<DetailRow label="A" value="B" columnContext="multi" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/multi/);
  });
});

describe('ChoiceGroup', () => {
  const options = [{ value: 'travel', label: 'Travel' }, { value: 'onsite', label: 'On site', description: 'Time at the customer location' }];
  const Harness = ({ onChange = () => {} }: { onChange?: (v: string) => void }) => {
    const [sel, setSel] = useState<string | null>(null);
    return <ChoiceGroup legend="Time type" name="time" options={options} selection={sel} onChange={(v) => { setSel(v); onChange(v); }} emptyTitle="No options" emptyExplanation="Options appear when the job supplies them." />;
  };
  it('is a labeled radio group of supplied options', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Time type' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
  });
  it('emits change with the chosen value and shows it checked', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /On site/ }));
    expect(onChange).toHaveBeenCalledWith('onsite');
    expect(screen.getByRole('radio', { name: /On site/ })).toBeChecked();
  });
  it('explains an empty option list instead of rendering blank', () => {
    render(<ChoiceGroup legend="Time type" name="t" options={[]} selection={null} onChange={() => {}} emptyTitle="No options" emptyExplanation="Options appear when the job supplies them." />);
    expect(screen.getByText('Options appear when the job supplies them.')).toBeInTheDocument();
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<Harness />);
    expect(await violations(container)).toEqual([]);
  });
});

describe('NumberInput', () => {
  const Harness = ({ minimum, maximum, onChange }: { minimum?: number; maximum?: number; onChange?: (v: number | null) => void }) => {
    const [v, setV] = useState<number | null>(5);
    return (
      <FormField id="qty" label="Quantity">
        <NumberInput id="qty" value={v} minimum={minimum} maximum={maximum} onChange={(n) => { setV(n); onChange?.(n); }} steppers={{ decrementLabel: 'Decrease quantity', incrementLabel: 'Increase quantity' }} />
      </FormField>
    );
  };
  it('emits typed numbers within the supplied bounds', () => {
    const onChange = vi.fn();
    render(<Harness minimum={1} maximum={10} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });
  it('does not emit an out-of-range entry while typing, and settles to the nearest bound on blur', () => {
    const onChange = vi.fn();
    render(<Harness minimum={1} maximum={10} onChange={onChange} />);
    const field = screen.getByLabelText('Quantity');
    fireEvent.change(field, { target: { value: '99' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(10);
    expect(field).toHaveValue('10');
  });
  it('rejects non-numeric characters (a structural constraint)', () => {
    render(<Harness />);
    const field = screen.getByLabelText('Quantity');
    fireEvent.change(field, { target: { value: 'abc' } });
    expect(field).toHaveValue('5');
  });
  it('steps by the supplied step and disables a stepper at its bound', () => {
    render(<Harness minimum={4} maximum={6} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(screen.getByLabelText('Quantity')).toHaveValue('4');
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<Harness />);
    expect(await violations(container)).toEqual([]);
  });
});

describe('LookupField', () => {
  const results = [{ id: 'a', label: 'WO-48213', detail: 'Northgate Grocers' }, { id: 'b', label: 'WO-48214' }];
  const setup = (data: 'idle' | 'loading' | 'ready' | 'empty' = 'ready', onSelect = vi.fn(), onQueryChange = vi.fn()) => {
    render(
      <FormField id="wo" label="Work order">
        <LookupField id="wo" query="WO" onQueryChange={onQueryChange} results={results} data={data} emptyMessage="No work order matches." loadingMessage="Searching." onSelect={onSelect} />
      </FormField>,
    );
    return { field: screen.getByRole('combobox', { name: 'Work order' }), onSelect, onQueryChange };
  };
  it('is a combobox that renders only the supplied results, in order', () => {
    const { field } = setup();
    fireEvent.focus(field);
    expect(field).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['WO-48213Northgate Grocers', 'WO-48214']);
  });
  it('emits query-change, and never fetches', () => {
    const { field, onQueryChange } = setup();
    fireEvent.change(field, { target: { value: 'WO-4' } });
    expect(onQueryChange).toHaveBeenCalledWith('WO-4');
  });
  it('moves with arrow keys, selects with Enter, and closes with Escape', () => {
    const { field, onSelect } = setup();
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(field).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveAttribute('aria-expanded', 'false');
  });
  it('selects an option on pointer press without losing the choice to blur', () => {
    const { field, onSelect } = setup();
    fireEvent.focus(field);
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    expect(onSelect).toHaveBeenCalledWith('a');
  });
  it('shows a supplied explanation when empty, and announces loading', () => {
    const { field } = setup('empty');
    fireEvent.focus(field);
    expect(screen.getAllByText('No work order matches.').length).toBeGreaterThan(0);
  });
  it('announces the supplied loading message', () => {
    setup('loading');
    expect(screen.getByRole('status')).toHaveTextContent('Searching.');
  });
  it('has no structural accessibility violations', async () => {
    const { field } = setup();
    fireEvent.focus(field);
    expect(await violations(document.body)).toEqual([]);
  });
});

describe('WorkflowStepper', () => {
  const steps: WorkflowStep[] = [
    { id: 'arrive', label: 'Arrive', completion: 'complete', statusLabel: 'Done', detail: 'Arrived at 8:02 AM' },
    { id: 'diagnose', label: 'Diagnose', completion: 'incomplete', statusLabel: 'In progress', detail: 'Check the defrost sensor', advanceLabel: 'Record diagnosis' },
    { id: 'close', label: 'Close out', completion: 'incomplete', statusLabel: 'Not started' },
  ];
  it('renders the supplied order, completion text and the supplied active step', () => {
    render(<WorkflowStepper steps={steps} activeStepId="diagnose" ariaLabel="Job steps" />);
    const items = within(screen.getByRole('list', { name: 'Job steps' })).getAllByRole('listitem');
    expect(items.map((i) => within(i).getAllByRole('button')[0].textContent)).toEqual([
      expect.stringContaining('Arrive'), expect.stringContaining('Diagnose'), expect.stringContaining('Close out'),
    ]);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Diagnose/ })).toHaveAttribute('aria-current', 'step');
  });
  it('opens the active step by default and toggles others, emitting step-select', () => {
    const onSelect = vi.fn();
    render(<WorkflowStepper steps={steps} activeStepId="diagnose" ariaLabel="Job steps" onSelect={onSelect} />);
    expect(screen.getByText('Check the defrost sensor')).toBeVisible();
    expect(screen.queryByText('Arrived at 8:02 AM')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Arrive/ }));
    expect(screen.getByText('Arrived at 8:02 AM')).toBeVisible();
    expect(onSelect).toHaveBeenCalledWith('arrive');
  });
  it('emits step-advance from the active step and completes nothing itself', () => {
    const onAdvance = vi.fn();
    render(<WorkflowStepper steps={steps} activeStepId="diagnose" ariaLabel="Job steps" onAdvance={onAdvance} />);
    fireEvent.click(screen.getByRole('button', { name: 'Record diagnosis' }));
    expect(onAdvance).toHaveBeenCalledWith('diagnose');
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });
  it('restores which step was open, and hands it back on release (continuity only)', () => {
    const onContinuity = vi.fn();
    const { unmount } = render(<WorkflowStepper steps={steps} activeStepId="diagnose" ariaLabel="Job steps" initialContinuity={{ expandedId: 'arrive' }} onContinuity={onContinuity} />);
    expect(screen.getByText('Arrived at 8:02 AM')).toBeVisible();
    unmount();
    expect(onContinuity).toHaveBeenCalledWith({ expandedId: 'arrive' });
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<WorkflowStepper steps={steps} activeStepId="diagnose" ariaLabel="Job steps" />);
    expect(await violations(container)).toEqual([]);
  });
});

describe('PhotoCapture', () => {
  const base = { prompt: 'Photograph the data plate', captureLabel: 'Take photo', requiredLabel: 'Required', emptyMessage: 'No photo yet.', captured: [] as const };
  it('shows the supplied prompt, requirement text and empty message', () => {
    render(<PhotoCapture {...base} required onCaptureComplete={() => {}} />);
    expect(screen.getByText('Photograph the data plate')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('No photo yet.')).toBeInTheDocument();
  });
  it('hides the requirement text when the photo is not required', () => {
    render(<PhotoCapture {...base} onCaptureComplete={() => {}} />);
    expect(screen.queryByText('Required')).toBeNull();
  });
  it('renders supplied thumbnails with supplied alt text', () => {
    render(<PhotoCapture {...base} captured={[{ id: 'p1', previewUrl: 'blob:x', label: 'Data plate' }]} onCaptureComplete={() => {}} />);
    expect(screen.getByAltText('Data plate')).toBeInTheDocument();
    expect(screen.queryByText('No photo yet.')).toBeNull();
  });
  it('emits capture-request on activation and hands chosen files upward untouched', () => {
    const onRequest = vi.fn();
    const onComplete = vi.fn();
    const { container } = render(<PhotoCapture {...base} onCaptureRequest={onRequest} onCaptureComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    expect(onRequest).toHaveBeenCalled();
    const file = new File(['x'], 'plate.jpg', { type: 'image/jpeg' });
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } });
    expect(onComplete).toHaveBeenCalledWith([file]);
  });
  it('has no structural accessibility violations', async () => {
    const { container } = render(<PhotoCapture {...base} onCaptureComplete={() => {}} />);
    expect(await violations(container)).toEqual([]);
  });
});
