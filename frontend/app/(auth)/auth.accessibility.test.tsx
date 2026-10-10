// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import axe from 'axe-core';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams('reason=expired') }));

import { LoginScreen } from './login/LoginScreen';
import { SignupScreen } from './signup/SignupScreen';

// Structural accessibility of the auth screens (BRD 1.3 section 11, 1.0 UR15), including their ERROR states, which are
// where forms usually break: error text must be associated with its field and announced.
async function violations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

describe('axe: auth screens', () => {
  it('sign in, pristine', async () => {
    const { container } = render(<LoginScreen />);
    expect(await violations(container)).toEqual([]);
  });

  it('sign in, with validation errors shown', async () => {
    const { container } = render(<LoginScreen />);
    await act(async () => void fireEvent.submit(container.querySelector('form')!));
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    expect(await violations(container)).toEqual([]);
  });

  it('sign up, pristine', async () => {
    const { container } = render(<SignupScreen />);
    expect(await violations(container)).toEqual([]);
  });

  it('sign up, with validation errors shown', async () => {
    const { container } = render(<SignupScreen />);
    await act(async () => void fireEvent.submit(container.querySelector('form')!));
    expect(await violations(container)).toEqual([]);
  });
});
