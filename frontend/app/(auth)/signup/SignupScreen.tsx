'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, FormField, Link, PasswordInput, SectionHeader, StatusIndicator, Surface, TextInput } from '@/components';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  SIGNUP_FIELDS,
  validateSignup,
  type FieldErrors,
} from '@/contracts';
import { getUpstream } from '@/clients/upstream';
import { focusFirstInvalid } from '@/runtime/auth/focusInvalid';
import { useCountdown } from '@/runtime/auth/useCountdown';
import { useSubmitLock } from '@/runtime/auth/useSubmitLock';
import { logEvent } from '@/runtime/telemetry';
import { messages } from '@/render/messages';
import { signupThrottle } from '../throttles';
import styles from '../auth.module.css';

type Field = (typeof SIGNUP_FIELDS)[number];
const EMPTY = { fullName: '', email: '', password: '', confirmPassword: '' };

// Sign up. The worker never chooses a role: it is resolved upstream after the address is verified (BRD 1.0 UR3).
export function SignupScreen() {
  const { processing, run } = useSubmitLock();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState(false);
  const [coolRun, setCoolRun] = useState(0);
  // Bumped after a failure. The effect below moves focus once the inputs are enabled again (a disabled field cannot take focus).
  const [refocus, setRefocus] = useState(0);
  const doneRef = useRef<HTMLDivElement>(null);

  const secondsLeft = useCountdown(() => signupThrottle.remainingMs(), coolRun);
  const cooling = secondsLeft > 0;

  useEffect(() => {
    if (refocus > 0) document.getElementById('password')?.focus();
  }, [refocus]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const update = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (attempted) {
      const r = validateSignup(next);
      setErrors(r.ok ? {} : r.errors);
    }
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (cooling || processing) return;

    setAttempted(true);
    setFailure(null);
    const parsed = validateSignup(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      logEvent('auth.validation_failed', 'info');
      focusFirstInvalid(SIGNUP_FIELDS, parsed.errors);
      return;
    }
    setErrors({});

    await run(async () => {
      let message: string;
      try {
        // Only the validated, normalized fields go to the provider. The confirmation field never leaves the form.
        const { fullName, email, password } = parsed.data;
        const result = await getUpstream().auth.signUp({ fullName, email, password });
        if (result.ok) {
          signupThrottle.recordSuccess();
          logEvent('auth.sign_up_submitted', 'info');
          // Clear every secret out of component state before showing the confirmation.
          setValues(EMPTY);
          setDone(true);
          return 'released';
        }
        logEvent('auth.sign_up_failed', 'warn', result.reason);
        message = messages.signup.failures[result.reason];
      } catch {
        logEvent('auth.sign_up_failed', 'warn', 'network');
        message = messages.signup.failures.network;
      }

      signupThrottle.recordFailure();
      if (signupThrottle.isLocked()) {
        logEvent('auth.throttled', 'warn', 'rate_limited');
        setCoolRun((n) => n + 1);
      }
      setFailure(message);
      setValues((v) => ({ ...v, password: '', confirmPassword: '' }));
      setRefocus((n) => n + 1);
      return 'released';
    });
  }

  if (done) {
    return (
      <Surface role="card" padding={6}>
        <div className={styles.done} ref={doneRef} tabIndex={-1} role="status">
          <SectionHeader text={messages.signup.doneTitle} level={1} size="lg" />
          <p className="type-body">{messages.signup.doneBody}</p>
          <Link label={messages.signup.backToSignIn} href="/login" />
        </div>
      </Surface>
    );
  }

  return (
    <Surface role="card" padding={6}>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={processing || undefined}>
        <SectionHeader text={messages.signup.title} level={1} size="lg" />

        {failure && (
          <p className={`${styles.notice} type-body`} role="alert">
            <StatusIndicator state="error" label="Could not create account" decorative />
            {failure}
          </p>
        )}

        {cooling && (
          <p className={`${styles.notice} type-body`} role="status">
            <StatusIndicator state="warning" label="Please wait" decorative />
            {messages.login.throttled(secondsLeft)}
          </p>
        )}

        <FormField id="fullName" label={messages.signup.fullName} validationMessage={errors.fullName && messages.validation[errors.fullName]}>
          <TextInput
            id="fullName"
            name="name"
            autoComplete="name"
            maxLength={NAME_MAX_LENGTH}
            value={values.fullName}
            onChange={(v) => update('fullName', v)}
            invalid={!!errors.fullName}
            describedBy={errors.fullName ? 'fullName-message' : undefined}
            disabled={processing}
          />
        </FormField>

        <FormField id="email" label={messages.signup.email} validationMessage={errors.email && messages.validation[errors.email]}>
          <TextInput
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            hardened
            maxLength={EMAIL_MAX_LENGTH}
            value={values.email}
            onChange={(v) => update('email', v)}
            invalid={!!errors.email}
            describedBy={errors.email ? 'email-message' : undefined}
            disabled={processing}
          />
        </FormField>

        <FormField
          id="password"
          label={messages.signup.password}
          helpText={messages.signup.passwordHelp}
          validationMessage={errors.password && messages.validation[errors.password]}
        >
          <PasswordInput
            id="password"
            name="new-password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            value={values.password}
            onChange={(v) => update('password', v)}
            invalid={!!errors.password}
            describedBy="password-message"
            disabled={processing}
            showLabel={messages.login.showPassword}
            hideLabel={messages.login.hidePassword}
          />
        </FormField>

        <FormField id="confirmPassword" label={messages.signup.confirmPassword} validationMessage={errors.confirmPassword && messages.validation[errors.confirmPassword]}>
          <PasswordInput
            id="confirmPassword"
            name="confirm-password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            value={values.confirmPassword}
            onChange={(v) => update('confirmPassword', v)}
            invalid={!!errors.confirmPassword}
            describedBy={errors.confirmPassword ? 'confirmPassword-message' : undefined}
            disabled={processing}
            showLabel={messages.login.showPassword}
            hideLabel={messages.login.hidePassword}
          />
        </FormField>

        <Button
          type="submit"
          label={messages.signup.submit}
          processing={processing}
          processingLabel={messages.signup.submitting}
          disabled={cooling}
          fullWidth
        />

        <p className={`${styles.switch} type-body-sm`}>
          {messages.signup.signInPrompt} <Link label={messages.signup.signInLink} href="/login" />
        </p>
      </form>
    </Surface>
  );
}
