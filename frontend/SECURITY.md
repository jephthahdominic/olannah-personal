# Auth and form security

What the frontend enforces, and what the backend **must** enforce. Browser code can be bypassed by anyone with `curl`, so every browser-side control below is for clear errors, defence in depth and a good experience. **None of it replaces server enforcement.** The canvas is also not an authorization boundary (BRD 1.0 SR23C).

## Enforced in the browser (built, tested)

| Practice | Where | Notes |
|---|---|---|
| Schema validation with **zod** | `contracts/auth.ts` | Email trimmed, lower-cased, max 254, RFC-shaped. Password max 128. Name: letters, marks, `'`, `-`, `.`, space only; 2 to 80 chars; whitespace collapsed. No control characters anywhere. Unknown fields are stripped, so an injected `role` or `isAdmin` never reaches the provider. |
| **Codes, not values, in errors** | `contracts/auth.ts`, `render/messages.ts` | Validation emits stable codes mapped to plain-language text. A submitted value can never appear in an error, a log or the DOM message. |
| Password policy (signup) | `contracts/auth.ts` | 12 to 128 characters, deny-list of common passwords, may not contain the email's local part, confirmation must match. Length over composition rules (NIST SP 800-63B). Sign in does **not** apply the policy, so an older password still works. |
| **Click and disable** | `runtime/auth/useSubmitLock.ts` | A synchronous ref guard plus a `processing` flag. A click, Enter and a scripted `submit()` in the same tick produce **one** request. Inputs disable, the button goes busy and inert. After success the lock is held until navigation. Released after a failure. |
| Client attempt throttle | `runtime/auth/attemptThrottle.ts` | 5 free failures, then 30s doubling to 5 min, with a live countdown and a disabled button. Validation failures do not count. In memory only, so a reload resets it. |
| No account enumeration | `contracts`, `clients`, `messages` | Sign in gives one message for "unknown account" and "wrong password". Sign up shows the same confirmation whether or not the address exists. |
| Secrets never kept | screens, `runtime/telemetry.ts` | Password cleared after a failure and after success. Not in state beyond the form, URL, storage, telemetry or DOM text (tests assert each). Telemetry takes only enumerated event names and reason codes. |
| Password manager and a11y friendly | `PasswordInput`, `TextInput` | `autocomplete` is `username`, `email`, `current-password`, `new-password`. `autocapitalize`/`autocorrect`/`spellcheck` off. **Paste is never blocked.** Show/hide toggle with `aria-pressed`. |
| Focus and announcements | `runtime/auth/focusInvalid.ts` | First invalid field gets focus. Errors are tied to fields with `aria-describedby`/`aria-invalid`. Failures use `role=alert`. |
| No open redirect | `LoginScreen.tsx` | The post-login destination is the constant `/`. No query parameter is ever used as a target. The `reason` flag is matched against one exact value. |
| Role never chosen client-side | `SignupScreen.tsx` | Role is resolved upstream after verification. |
| HTTP hardening | `next.config.ts` (tested live) | CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`, upgrade-insecure-requests), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, HSTS (production), no `X-Powered-By`, `Cache-Control: no-store` on `/login` and `/signup`. |
| Static rules | `eslint.config.mjs` | No `dangerouslySetInnerHTML`, no browser storage or cookies outside the mock IdP, no network outside `clients/`. |

## The backend MUST enforce (cannot be done in the browser)

1. **Re-validate every field** with the same rules (the mock does this to prove the point).
2. **Rate limit and lock out** per account **and** per IP and device, with a lockout that is hard to abuse for denial of service. The client throttle is advisory.
3. **Breached-password check** against a large list (the client deny-list is tiny). Hash with Argon2id (or bcrypt/scrypt), per-user salt, never log or return passwords.
4. **Email verification** before an account can sign in, with a single-use, expiring token. Sign-up responses must stay identical for new and existing addresses, including **timing**.
5. **Session cookies**: `HttpOnly`, `Secure`, `SameSite`, rotation on login, expiry and server-side revocation. If cookie auth is used for any form post, add **CSRF protection** (token or `SameSite` + origin checks).
6. **Generic sign-in errors** server-side too, and constant-time comparison.
7. **MFA / SSO** policy, and password reset (not built: not specified).
8. **Audit and alerting** for repeated failures and lockouts (log the account identifier server-side, never the password).

## Known gaps and decisions

- **CSP `script-src 'unsafe-inline'`** is required today by Next.js inline bootstrap scripts. Plan: hashed scripts or nonces on a dynamic render. `connect-src` is `'self'` and **each real upstream origin must be added** when it exists, never a wildcard.
- **Signup is not in any BRD.** The BRDs describe SSO sign-in only. Signup is built behind the swappable `AuthProvider` with mock behaviour (accounts are never created, as a real unverified account would be). **Product must confirm** whether self-signup exists, or whether accounts are invited or provisioned through SSO.
- **No terms/consent checkbox**: no Checkbox component exists in the library yet.
- **No password reset, MFA, or "remember me"**: not specified.
- **Mock mode is the default.** Production builds must set `NEXT_PUBLIC_UPSTREAM_MODE=real` or the mock accounts and the fault panel are available.
- CAPTCHA/bot protection is a server and edge decision (not added).
