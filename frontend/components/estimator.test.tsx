// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select, DatePicker, HealthBadge, FormField } from './index';

const options = [
  { value: 'sensor', label: 'Intermittent open sensor' },
  { value: 'fan', label: 'Failed fan motor' },
  { value: 'ice', label: 'Evaporator ice buildup', disabled: true },
];

describe('Select (BRD 1.2 5.7, estimator P0.5)', () => {
  it('renders the supplied options and a disabled placeholder when nothing is chosen', () => {
    render(<Select id="s" selection={null} onChange={() => {}} options={options} placeholder="Choose a failure condition" emptyLabel="None" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Choose a failure condition' })).toBeDisabled();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a failure condition', 'Intermittent open sensor', 'Failed fan motor', 'Evaporator ice buildup']);
    expect(screen.getByRole('option', { name: 'Evaporator ice buildup' })).toBeDisabled();
  });

  it('is controlled: it shows the supplied selection and emits the chosen value, holding nothing itself', () => {
    const onChange = vi.fn();
    render(<Select id="s" selection="fan" onChange={onChange} options={options} placeholder="Choose" emptyLabel="None" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('fan');
    fireEvent.change(select, { target: { value: 'sensor' } });
    expect(onChange).toHaveBeenCalledWith('sensor');
    expect(select).toHaveValue('fan'); // not changed until the composing layer says so
  });

  it('explains an empty list in the control itself, and cannot be opened (never blank)', () => {
    render(<Select id="s" selection={null} onChange={() => {}} options={[]} placeholder="Choose" emptyLabel="No conditions supplied" />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('No conditions supplied')).toBeInTheDocument();
  });

  it('takes its accessible name from a visible label, and exposes validation to assistive technology', () => {
    render(
      <FormField id="cond" label="Failure condition" validationMessage="Choose a condition.">
        <Select id="cond" selection={null} onChange={() => {}} options={options} placeholder="Choose" emptyLabel="None" invalid describedBy="cond-message" />
      </FormField>,
    );
    const select = screen.getByLabelText('Failure condition');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Choose a condition.');
  });

  it('does not alter the supplied option set (no filtering, no reordering, no business rule)', () => {
    const supplied = [...options].reverse();
    render(<Select id="s" selection={null} onChange={() => {}} options={supplied} placeholder="Choose" emptyLabel="None" />);
    expect(screen.getAllByRole('option').slice(1).map((o) => o.getAttribute('value'))).toEqual(['ice', 'fan', 'sensor']);
  });

  it('can be disabled, and reports focus and blur upward', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { rerender } = render(<Select id="s" selection={null} onChange={() => {}} options={options} placeholder="Choose" emptyLabel="None" onFocus={onFocus} onBlur={onBlur} />);
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.blur(screen.getByRole('combobox'));
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
    rerender(<Select id="s" selection={null} onChange={() => {}} options={options} placeholder="Choose" emptyLabel="None" disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});

describe('DatePicker (BRD 1.2 5.7, estimator P0.5)', () => {
  const picker = (over: Partial<Parameters<typeof DatePicker>[0]> = {}) => (
    <DatePicker id="d" meaning="valid-through" value="2026-10-17" onChange={() => {}} min="2026-10-10" max="2026-10-31" {...over} />
  );
  const field = () => screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}|^$/) as HTMLInputElement;

  it('is a native date control carrying the SUPPLIED bounds and the specific meaning of the value', () => {
    const { container } = render(picker());
    const input = container.querySelector('input')!;
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('min', '2026-10-10');
    expect(input).toHaveAttribute('max', '2026-10-31');
    expect(input).toHaveAttribute('data-meaning', 'valid-through');
    expect(input).toHaveAttribute('name', 'valid-through');
    expect(input).toHaveValue('2026-10-17');
  });

  it('emits a real date inside the bounds', () => {
    const onChange = vi.fn();
    const { container } = render(picker({ onChange }));
    fireEvent.change(container.querySelector('input')!, { target: { value: '2026-10-20' } });
    expect(onChange).toHaveBeenCalledWith('2026-10-20');
  });

  it.each([
    ['before the minimum', '2026-10-01'],
    ['after the maximum', '2026-11-15'],
  ])('ignores a date %s, and stays on the last accepted value (it enforces bounds it was given, never derives its own)', (_n, bad) => {
    const onChange = vi.fn();
    const { container } = render(picker({ onChange }));
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: bad } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('2026-10-17');
  });

  it('never emits an impossible calendar date as a value (the platform control reports it as empty, and nothing is rolled into a real date)', () => {
    const onChange = vi.fn();
    const { container } = render(picker({ onChange, min: undefined, max: undefined }));
    for (const bad of ['2026-02-30', '2026-13-01']) fireEvent.change(container.querySelector('input')!, { target: { value: bad } });
    for (const call of onChange.mock.calls) expect(call[0]).toBeNull();
  });

  it('emits null when cleared', () => {
    const onChange = vi.fn();
    const { container } = render(picker({ onChange }));
    fireEvent.change(container.querySelector('input')!, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows an empty value as empty, not a placeholder date', () => {
    const { container } = render(picker({ value: null }));
    expect(container.querySelector('input')).toHaveValue('');
  });

  it('takes a visible label and exposes validation text', () => {
    render(
      <FormField id="d" label="Valid through" validationMessage="Pick a date in range.">
        <DatePicker id="d" meaning="valid-through" value={null} onChange={() => {}} invalid describedBy="d-message" />
      </FormField>,
    );
    expect(screen.getByLabelText('Valid through')).toHaveAccessibleDescription('Pick a date in range.');
  });

  describe('never shifts a site-local date with the viewer time zone', () => {
    const original = process.env.TZ;
    afterEach(() => void (process.env.TZ = original));
    it.each(['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati'])('stays put under TZ=%s', (tz) => {
      process.env.TZ = tz;
      const { container } = render(picker({ value: '2026-10-17' }));
      expect(container.querySelector('input')).toHaveValue('2026-10-17');
    });
  });

  it('reports focus and blur upward, and can be disabled', () => {
    const onFocus = vi.fn();
    const { container, rerender } = render(picker({ onFocus }));
    fireEvent.focus(container.querySelector('input')!);
    expect(onFocus).toHaveBeenCalled();
    rerender(picker({ disabled: true }));
    expect(container.querySelector('input')).toBeDisabled();
  });
  void field;
});

describe('HealthBadge (BRD 1.2 5.8, estimator P0.5)', () => {
  const shapeOf = (container: HTMLElement) => container.querySelector('svg')!.innerHTML.replace(/class="[^"]*"/g, '');

  it('uses a different SHAPE for available, degraded and unavailable, so state is never color alone', () => {
    const shapes = (['available', 'degraded', 'unavailable'] as const).map((a) => {
      const { container, unmount } = render(<HealthBadge availability={a} label={a} />);
      const s = shapeOf(container);
      unmount();
      return s;
    });
    expect(new Set(shapes).size).toBe(3);
  });

  it('exposes the supplied label to assistive technology', () => {
    render(<HealthBadge availability="degraded" label="Parts portal is degraded" />);
    expect(screen.getByRole('img', { name: 'Parts portal is degraded' })).toBeInTheDocument();
  });

  it('shows optional visible text beside the shape', () => {
    render(<HealthBadge availability="available" label="Service ERP is available" text="Service ERP" />);
    expect(screen.getByText('Service ERP')).toBeInTheDocument();
  });

  it('renders a lost or reconnecting feed differently from any availability, instead of presenting a stale answer as current', () => {
    const base = render(<HealthBadge availability="available" label="x" />);
    const available = shapeOf(base.container);
    base.unmount();
    const rec = render(<HealthBadge availability="available" connection="reconnecting" label="x" />);
    const reconnecting = shapeOf(rec.container);
    rec.unmount();
    const lost = render(<HealthBadge availability="available" connection="disconnected" label="x" />);
    const disconnected = shapeOf(lost.container);
    expect(new Set([available, reconnecting, disconnected]).size).toBe(3);
  });

  it('keeps availability and connection as separate, inspectable dimensions', () => {
    const { container } = render(<HealthBadge availability="unavailable" connection="reconnecting" label="x" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('data-availability', 'unavailable');
    expect(el).toHaveAttribute('data-connection', 'reconnecting');
  });

  it('defaults to a live connection', () => {
    const { container } = render(<HealthBadge availability="available" label="x" />);
    expect(container.firstChild).toHaveAttribute('data-connection', 'connected');
  });
});
