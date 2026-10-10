'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, FormField, Link, PasswordInput, SectionHeader, StatusIndicator, Surface, TextInput } from '@/components';
import { LOGIN_FIELDS, PASSWORD_MAX_LENGTH, EMAIL_MAX_LENGTH, validateLogin, type FieldErrors } from '@/contracts';
import { getUpstream } from '@/clients/upstream';
import { focusFirstInvalid } from '@/runtime/auth/focusInvalid';
import { useCountdown } from '@/runtime/auth/useCountdown';
import { useSubmitLock } from '@/runtime/auth/useSubmitLock';
import { logEvent } from '@/runtime/telemetry';
import { messages } from '@/render/messages';
import { loginThrottle } from '../throttles';
import styles from '../auth.module.css';

type Field = (typeof LOGIN_FIELDS)[number];

export function LoginScreen() {
  const router = useRouter();
  const expired = useSearchParams().get('reason') === 'expired';
  const { processing, run } = useSubmitLock();

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [coolRun, setCoolRun] = useState(0);
  // Bumped after a failure. The effect below moves focus once the inputs are enabled again (a disabled field cannot take focus).
  const [refocus, setRefocus] = useState(0);

  const secondsLeft = useCountdown(() => loginThrottle.remainingMs(), coolRun);
  const cooling = secondsLeft > 0;

  useEffect(() => {
    if (refocus > 0) document.getElementById('password')?.focus();
  }, [refocus]);

  // Once the worker has tried to submit, re-check on every keystroke so a fixed field clears its message straight away.
  const update = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (attempted) {
      const r = validateLogin(next);
      setErrors(r.ok ? {} : r.errors);
    }
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // A throttled form does nothing, however it was submitted (click, Enter, or a script calling submit()).
    if (cooling || processing) return;

    setAttempted(true);
    setFailure(null);
    const parsed = validateLogin(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      logEvent('auth.validation_failed', 'info');
      focusFirstInvalid(LOGIN_FIELDS, parsed.errors);
      return;
    }
    setErrors({});

    await run(async () => {
      let message: string;
      try {
        const result = await getUpstream().auth.signIn(parsed.data);
        if (result.ok) {
          loginThrottle.recordSuccess();
          // The destination is fixed. Nothing from the URL is ever used as a redirect target (no open redirect).
          router.replace('/');
          return 'held'; // stay locked until the page navigates, so a slow redirect cannot cause a second submit
        }
        logEvent('auth.sign_in_failed', 'warn', result.reason);
        message = messages.login.failures[result.reason];
      } catch {
        logEvent('auth.sign_in_failed', 'warn', 'network');
        message = messages.login.failures.network;
      }

      loginThrottle.recordFailure();
      if (loginThrottle.isLocked()) {
        logEvent('auth.throttled', 'warn', 'rate_limited');
        setCoolRun((n) => n + 1);
      }
      setFailure(message);
      // Never keep a rejected password in the form. Put focus back where the worker needs to type.
      setValues((v) => ({ ...v, password: '' }));
      setRefocus((n) => n + 1);
      return 'released';
    });
  }

  return (
    <Surface role="card" padding={6}>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={processing || undefined}>
        <SectionHeader text={messages.login.title} level={1} size="lg" />

        {expired && (
          <p className={`${styles.notice} type-body`} role="status">
            <StatusIndicator state="inactive" label={messages.login.expiredNotice} decorative />
            {messages.login.expiredNotice}
          </p>
        )}

        {failure && (
          <p className={`${styles.notice} type-body`} role="alert">
            <StatusIndicator state="error" label="Sign in failed" decorative />
            {failure}
          </p>
        )}

        {cooling && (
          <p className={`${styles.notice} type-body`} role="status">
            <StatusIndicator state="warning" label="Please wait" decorative />
            {messages.login.throttled(secondsLeft)}
          </p>
        )}

        <FormField id="email" label={messages.login.email} validationMessage={errors.email && messages.validation[errors.email]}>
          <TextInput
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            hardened
            maxLength={EMAIL_MAX_LENGTH}
            value={values.email}
            onChange={(v) => update('email', v)}
            invalid={!!errors.email}
            describedBy={errors.email ? 'email-message' : undefined}
            disabled={processing}
          />
        </FormField>

        <FormField id="password" label={messages.login.password} validationMessage={errors.password && messages.validation[errors.password]}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
            value={values.password}
            onChange={(v) => update('password', v)}
            invalid={!!errors.password}
            describedBy={errors.password ? 'password-message' : undefined}
            disabled={processing}
            showLabel={messages.login.showPassword}
            hideLabel={messages.login.hidePassword}
          />
        </FormField>

        <Button
          type="submit"
          label={messages.login.submit}
          processing={processing}
          processingLabel={messages.login.submitting}
          disabled={cooling}
          fullWidth
        />

        <p className={`${styles.switch} type-body-sm`}>
          {messages.login.signUpPrompt} <Link label={messages.login.signUpLink} href="/signup" />
        </p>
      </form>
    </Surface>
  );
}
