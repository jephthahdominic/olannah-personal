// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, FormField, StatusIndicator, TextInput } from './index';

describe('Button', () => {
  it('emits activate once and is a named control', () => {
    const onActivate = vi.fn();
    render(<Button label="Sign in" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('stays in place while processing, keeps its label, and ignores repeat activation', () => {
    const onActivate = vi.fn();
    render(<Button label="Sign in" processing processingLabel="Signing in" onActivate={onActivate} />);
    const button = screen.getByRole('button', { name: /Sign in/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does not activate when disabled', () => {
    const onActivate = vi.fn();
    render(<Button label="Sign in" disabled onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('StatusIndicator', () => {
  it.each(['success', 'warning', 'error', 'checkpoint', 'inactive', 'loading'] as const)(
    'exposes %s with an accessible label, never by color alone',
    (state) => {
      render(<StatusIndicator state={state} label={`state ${state}`} />);
      expect(screen.getByRole('img', { name: `state ${state}` })).toBeInTheDocument();
    },
  );

  it('uses a distinct shape for each state', () => {
    const shapes = (['success', 'warning', 'error', 'checkpoint'] as const).map((state) => {
      const { container, unmount } = render(<StatusIndicator state={state} label={state} />);
      const markup = container.innerHTML.replace(/class="[^"]*"/g, '').replace(/aria-label="[^"]*"/g, '');
      unmount();
      return markup;
    });
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('hides a decorative indicator from assistive technology', () => {
    const { container } = render(<StatusIndicator state="error" label="Problem" decorative />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('FormField + TextInput', () => {
  it('associates a visible label with the control and renders supplied validation text', () => {
    render(
      <FormField id="email" label="Email" validationMessage="Enter your email address.">
        <TextInput id="email" value="" onChange={() => {}} invalid describedBy="email-message" />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter your email address.');
  });

  it('is controlled: it renders the supplied value and emits changes without holding its own copy', () => {
    const onChange = vi.fn();
    render(<TextInput id="x" value="abc" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('abc');
    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(onChange).toHaveBeenCalledWith('abcd');
    expect(input).toHaveValue('abc');
  });
});
