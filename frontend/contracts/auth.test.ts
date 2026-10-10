import { describe, it, expect } from 'vitest';
import { validateLogin, validateSignup, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth';

const goodSignup = { fullName: 'Marcus Bell', email: 'marcus@example.com', password: 'a-long-enough-pass', confirmPassword: 'a-long-enough-pass' };
const codes = (r: ReturnType<typeof validateSignup>) => (r.ok ? {} : r.errors);

describe('login form validation', () => {
  it('accepts a valid login and normalizes the email (trim + lowercase) but never reshapes the password', () => {
    const r = validateLogin({ email: '  Marcus@Example.COM ', password: '  keep my spaces  ' });
    expect(r).toEqual({ ok: true, data: { email: 'marcus@example.com', password: '  keep my spaces  ' } });
  });

  it.each([
    [{ email: '', password: 'x' }, { email: 'email_required' }],
    [{ email: '   ', password: 'x' }, { email: 'email_required' }],
    [{ email: 'not-an-email', password: 'x' }, { email: 'email_invalid' }],
    [{ email: 'a@b', password: 'x' }, { email: 'email_invalid' }],
    [{ email: 'a@b.co', password: '' }, { password: 'password_required' }],
    [{ email: '', password: '' }, { email: 'email_required', password: 'password_required' }],
  ])('reports %j as %j', (values, expected) => {
    const r = validateLogin(values);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(expected);
  });

  it('does not apply the signup password policy to an existing account (a short or common password still reaches the server)', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'short' }).ok).toBe(true);
    expect(validateLogin({ email: 'a@b.co', password: 'password' }).ok).toBe(true);
  });

  it('rejects oversized and control-character input before it leaves the browser', () => {
    expect(validateLogin({ email: `${'a'.repeat(250)}@b.co`, password: 'x' })).toEqual({ ok: false, errors: { email: 'email_too_long' } });
    expect(validateLogin({ email: 'a@b.co', password: 'x'.repeat(PASSWORD_MAX_LENGTH + 1) })).toEqual({ ok: false, errors: { password: 'password_too_long' } });
    const r = validateLogin({ email: 'a\u0000@b.co', password: 'x' });
    expect(r.ok).toBe(false);
  });

  it('never throws on junk, and treats missing or wrongly-typed fields as invalid', () => {
    for (const junk of [null, undefined, 42, 'str', [], {}, { email: 1, password: 2 }]) {
      expect(() => validateLogin(junk)).not.toThrow();
      expect(validateLogin(junk).ok).toBe(false);
    }
  });

  it('strips unknown fields, so an injected extra field never reaches the provider', () => {
    const r = validateLogin({ email: 'a@b.co', password: 'x', role: 'admin', isAdmin: true });
    expect(r).toEqual({ ok: true, data: { email: 'a@b.co', password: 'x' } });
  });

  it('error output contains codes only, never the submitted value', () => {
    const r = validateLogin({ email: 'secret-typo-value', password: '' });
    expect(JSON.stringify(r)).not.toContain('secret-typo-value');
  });
});

describe('signup form validation', () => {
  it('accepts a valid signup, normalizing name and email', () => {
    const r = validateSignup({ ...goodSignup, fullName: '  Marcus    Bell ', email: ' Marcus@Example.com ' });
    expect(r).toMatchObject({ ok: true, data: { fullName: 'Marcus Bell', email: 'marcus@example.com' } });
  });

  it('enforces the password length bounds', () => {
    expect(codes(validateSignup({ ...goodSignup, password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1), confirmPassword: 'a'.repeat(PASSWORD_MIN_LENGTH - 1) }))).toMatchObject({ password: 'password_too_short' });
    const long = 'a-b'.repeat(60);
    expect(codes(validateSignup({ ...goodSignup, password: long, confirmPassword: long }))).toMatchObject({ password: 'password_too_long' });
    const exact = 'abcdefghijkl';
    expect(validateSignup({ ...goodSignup, password: exact, confirmPassword: exact }).ok).toBe(true);
  });

  it('rejects common passwords regardless of case', () => {
    for (const p of ['Password1234', 'QWERTY123456', 'olannah12345']) {
      expect(codes(validateSignup({ ...goodSignup, password: p, confirmPassword: p }))).toMatchObject({ password: 'password_common' });
    }
  });

  it('rejects a password built from the email address, and ignores a very short local part', () => {
    const p = 'marcus-is-great-1';
    expect(codes(validateSignup({ ...goodSignup, password: p, confirmPassword: p }))).toMatchObject({ password: 'password_contains_email' });
    const short = validateSignup({ ...goodSignup, email: 'al@example.com', password: 'xx-al-long-enough', confirmPassword: 'xx-al-long-enough' });
    expect(short.ok).toBe(true);
  });

  it('requires the confirmation to match', () => {
    expect(codes(validateSignup({ ...goodSignup, confirmPassword: 'different-password!' }))).toEqual({ confirmPassword: 'password_mismatch' });
    expect(codes(validateSignup({ ...goodSignup, confirmPassword: '' }))).toEqual({ confirmPassword: 'confirm_required' });
  });

  it.each([
    ['', 'name_required'],
    ['   ', 'name_required'],
    ['A', 'name_too_short'],
    ['x'.repeat(81), 'name_too_long'],
    ['Robert<script>', 'name_invalid'],
    ['Bell123', 'name_invalid'],
    ['1Marcus', 'name_invalid'],
    ['"; DROP TABLE users;--', 'name_invalid'],
  ])('rejects the name %j as %s', (fullName, code) => {
    expect(codes(validateSignup({ ...goodSignup, fullName }))).toMatchObject({ fullName: code });
  });

  it.each(["O'Brien", 'Jean-Luc Picard', 'Zoë Ångström', 'María José', 'Dr. Ng', 'Chukwuemeka Okafor', '李小龍'])('accepts the real-world name %s', (fullName) => {
    expect(validateSignup({ ...goodSignup, fullName }).ok).toBe(true);
  });

  it('never asks the worker for a role: role is resolved upstream, and an injected role field is dropped', () => {
    const r = validateSignup({ ...goodSignup, role: 'admin' });
    expect(r.ok).toBe(true);
    if (r.ok) expect('role' in r.data).toBe(false);
  });

  it('reports one code per field and never echoes the submitted values', () => {
    const r = validateSignup({ fullName: '', email: 'secret-typo', password: 'tiny-secret', confirmPassword: 'other' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['confirmPassword', 'email', 'fullName', 'password']);
      const json = JSON.stringify(r);
      expect(json).not.toContain('secret-typo');
      expect(json).not.toContain('tiny-secret');
    }
  });
});
