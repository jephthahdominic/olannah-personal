import { z } from 'zod';

// Form contracts for sign in and sign up. Validation here is for CLEAR ERRORS and for refusing obviously bad input
// before it leaves the browser. It is NOT a security boundary: the server must validate everything again and enforce
// rate limiting, lockout, password policy, CSRF protection and account-enumeration protection.
//
// Issues carry stable CODES (never raw zod text, never the submitted value), so the UI maps them to plain-language
// messages in the message catalogue and a value can never leak into an error string or a log.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

export type FormErrorCode =
  | 'email_required'
  | 'email_invalid'
  | 'email_too_long'
  | 'password_required'
  | 'password_too_short'
  | 'password_too_long'
  | 'password_common'
  | 'password_contains_email'
  | 'password_mismatch'
  | 'confirm_required'
  | 'name_required'
  | 'name_too_short'
  | 'name_too_long'
  | 'name_invalid'
  | 'invalid_characters';

// Control characters (including NUL) have no place in any field.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// A short deny-list of the most common passwords. Length matters more than composition rules (NIST SP 800-63B), so
// the policy is a long minimum plus this list, and the server should check a much larger breached-password list.
const COMMON_PASSWORDS = new Set(
  [
    'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd1234', 'qwertyuiop12', 'qwerty123456',
    '123456789012', '1234567890123', 'iloveyou1234', 'welcome12345', 'letmein12345', 'admin1234567', 'administrator',
    'changeme1234', 'abc123456789', 'monkey123456', 'dragon123456', 'football1234', 'baseball1234', 'olannah12345',
    'olannah123456', 'passwordpassword', '111111111111', '000000000000', 'aaaaaaaaaaaa', 'qazwsxedc123',
  ].map((p) => p.toLowerCase()),
);

const noControlChars = (v: string) => !CONTROL_CHARS.test(v);

/** Trimmed, lower-cased, length-capped, well-formed. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: 'email_required' })
  .max(EMAIL_MAX_LENGTH, { error: 'email_too_long' })
  .refine(noControlChars, { error: 'invalid_characters' })
  .pipe(z.email({ error: 'email_invalid' }));

// Sign in: the password is never trimmed or reshaped, and the signup policy is NOT applied (an existing password may
// predate it). Only presence and a sane upper bound are checked.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'password_required' }).max(PASSWORD_MAX_LENGTH, { error: 'password_too_long' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

const nameSchema = z
  .string()
  .trim()
  // collapse runs of whitespace so "Marcus   Bell" is stored as "Marcus Bell"
  .transform((v) => v.replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, { error: 'name_required' })
      .min(NAME_MIN_LENGTH, { error: 'name_too_short' })
      .max(NAME_MAX_LENGTH, { error: 'name_too_long' })
      // letters in any script, combining marks, apostrophe, hyphen, period and space: "O'Brien", "Jean-Luc", "Zoë"
      .regex(/^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u, { error: 'name_invalid' }),
  );

export const newPasswordSchema = z
  .string()
  .min(1, { error: 'password_required' })
  .min(PASSWORD_MIN_LENGTH, { error: 'password_too_short' })
  .max(PASSWORD_MAX_LENGTH, { error: 'password_too_long' })
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), { error: 'password_common' });

export const signupSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, { error: 'confirm_required' }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'password_mismatch' });
    }
    // A password built from the account's own email is guessable.
    const local = value.email.split('@')[0];
    if (local.length >= 4 && value.password.toLowerCase().includes(local)) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'password_contains_email' });
    }
  });
export type SignupInput = z.infer<typeof signupSchema>;

/** What the provider receives: validated, normalized, and without the confirmation field. */
export type SignUpRequest = Pick<SignupInput, 'fullName' | 'email' | 'password'>;

export type FieldErrors<K extends string> = Partial<Record<K, FormErrorCode>>;

export type FormResult<T, K extends string> = { ok: true; data: T } | { ok: false; errors: FieldErrors<K> };

/** Turns a zod result into at most ONE error code per field (the first), so the UI shows one clear message each. */
function toResult<T, K extends string>(parsed: ReturnType<z.ZodType<T>['safeParse']>, fields: readonly K[]): FormResult<T, K> {
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: FieldErrors<K> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as K | undefined;
    if (field && fields.includes(field) && !errors[field]) errors[field] = issue.message as FormErrorCode;
  }
  return { ok: false, errors };
}

export const LOGIN_FIELDS = ['email', 'password'] as const;
export const SIGNUP_FIELDS = ['fullName', 'email', 'password', 'confirmPassword'] as const;

export function validateLogin(values: unknown): FormResult<LoginInput, (typeof LOGIN_FIELDS)[number]> {
  return toResult(loginSchema.safeParse(values), LOGIN_FIELDS);
}

export function validateSignup(values: unknown): FormResult<SignupInput, (typeof SIGNUP_FIELDS)[number]> {
  return toResult(signupSchema.safeParse(values), SIGNUP_FIELDS);
}
