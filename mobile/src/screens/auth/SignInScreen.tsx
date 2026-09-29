import React, { useState } from 'react';
import { View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { spacing } from '../../theme/theme';
import { AppText } from '../../components/ui';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';
import { GoogleButton } from '../../components/GoogleButton';
import { useToast } from '../../components/Toast';
import { haptics } from '../../lib/haptics';
import { AuthError, AuthLayout, OrDivider, TextLink } from './AuthLayout';
import { clerkMessage, usePasswordRules } from './clerkHelpers';

/*
 * Mirrors the web app's Clerk <SignIn/> flow on the same Clerk instance:
 *   email → password (or a one-time email code) → new-device / 2FA code if Clerk
 *   asks for one → signed in. "Forgot password?" resets via an emailed code.
 */
type Step = 'email' | 'password' | 'email-code' | 'second-factor' | 'reset' | 'new-password';

const COPY: Record<Step, { title: string; subtitle: (email: string) => string }> = {
  email: { title: 'Welcome back', subtitle: () => 'Sign in to your farm management dashboard' },
  password: { title: 'Enter your password', subtitle: (e) => `Signing in as ${e}` },
  'email-code': { title: 'Check your email', subtitle: (e) => `Enter the code we sent to ${e}` },
  'second-factor': { title: 'Verify it’s you', subtitle: (e) => `For your security, enter the code we sent to ${e}` },
  reset: { title: 'Reset your password', subtitle: (e) => `Enter the code we sent to ${e} and choose a new password` },
  'new-password': { title: 'Set a new password', subtitle: () => 'Your password needs to be changed before you continue' },
};

export function SignInScreen({ navigation }: any) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const toast = useToast();
  const rules = usePasswordRules();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [secondFactor, setSecondFactor] = useState<{ strategy: string; emailAddressId?: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (next: Step) => {
    setError('');
    setCode('');
    setStep(next);
  };

  /** run a Clerk call with busy/error handling */
  const run = async (fn: () => Promise<void>) => {
    if (!isLoaded || !signIn) return;
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      haptics.error();
      setError(clerkMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const factor = (strategy: string): any => signIn?.supportedFirstFactors?.find((f: any) => f.strategy === strategy);

  /** route on the sign-in status Clerk returns after each step */
  const next = async (res: any) => {
    switch (res?.status) {
      case 'complete':
        haptics.success();
        await setActive!({ session: res.createdSessionId });
        return;
      case 'needs_second_factor': {
        const f: any =
          res.supportedSecondFactors?.find((x: any) => x.strategy === 'email_code') ??
          res.supportedSecondFactors?.find((x: any) => x.strategy === 'totp') ??
          res.supportedSecondFactors?.[0];
        if (!f) throw new Error('This account needs a verification method the app does not support yet. Please sign in on the web.');
        if (f.strategy === 'email_code' || f.strategy === 'phone_code') {
          await signIn!.prepareSecondFactor({ strategy: f.strategy, ...(f.emailAddressId ? { emailAddressId: f.emailAddressId } : {}), ...(f.phoneNumberId ? { phoneNumberId: f.phoneNumberId } : {}) } as any);
        }
        setSecondFactor({ strategy: f.strategy, emailAddressId: f.emailAddressId });
        go('second-factor');
        return;
      }
      case 'needs_new_password':
        go('new-password');
        return;
      default:
        throw new Error('Sign-in could not be completed. Please try again.');
    }
  };

  /* ---------------- step actions ---------------- */
  const submitEmail = () =>
    run(async () => {
      if (!email.trim()) {
        haptics.warning();
        throw new Error('Enter your email address.');
      }
      const res = await signIn!.create({ identifier: email.trim() });
      const methods = (res.supportedFirstFactors ?? []).map((f: any) => f.strategy);
      if (methods.includes('password')) go('password');
      else if (methods.includes('email_code')) await sendEmailCode();
      else throw new Error('This account uses a sign-in method the app does not support. Try “Continue with Google”.');
    });

  const submitPassword = () =>
    run(async () => {
      if (!password) throw new Error('Enter your password.');
      await next(await signIn!.attemptFirstFactor({ strategy: 'password', password }));
    });

  const sendEmailCode = async () => {
    const f = factor('email_code');
    if (!f) throw new Error('Email codes are not enabled for this account.');
    await signIn!.prepareFirstFactor({ strategy: 'email_code', emailAddressId: f.emailAddressId });
    go('email-code');
  };

  const submitEmailCode = () =>
    run(async () => {
      await next(await signIn!.attemptFirstFactor({ strategy: 'email_code', code: code.trim() }));
    });

  const submitSecondFactor = () =>
    run(async () => {
      await next(await signIn!.attemptSecondFactor({ strategy: secondFactor!.strategy as any, code: code.trim() }));
    });

  const startReset = () =>
    run(async () => {
      const f = factor('reset_password_email_code');
      if (!f) throw new Error('Password reset is not available for this account.');
      await signIn!.prepareFirstFactor({ strategy: 'reset_password_email_code', emailAddressId: f.emailAddressId });
      setNewPassword('');
      go('reset');
    });

  const submitReset = () =>
    run(async () => {
      const problem = rules.check(newPassword);
      if (problem) throw new Error(problem);
      const res = await signIn!.attemptFirstFactor({ strategy: 'reset_password_email_code', code: code.trim() });
      if (res.status === 'needs_new_password') {
        await next(await signIn!.resetPassword({ password: newPassword, signOutOfOtherSessions: true }));
      } else {
        await next(res);
      }
    });

  const submitNewPassword = () =>
    run(async () => {
      const problem = rules.check(newPassword);
      if (problem) throw new Error(problem);
      await next(await signIn!.resetPassword({ password: newPassword, signOutOfOtherSessions: true }));
    });

  const resend = () =>
    run(async () => {
      if (step === 'email-code') await sendEmailCode();
      else if (step === 'reset') {
        const f = factor('reset_password_email_code');
        await signIn!.prepareFirstFactor({ strategy: 'reset_password_email_code', emailAddressId: f.emailAddressId });
      } else if (step === 'second-factor' && secondFactor?.strategy === 'email_code') {
        await signIn!.prepareSecondFactor({ strategy: 'email_code', emailAddressId: secondFactor.emailAddressId } as any);
      }
      toast('A new code is on its way', 'info');
    });

  const restart = () => {
    setPassword('');
    setNewPassword('');
    go('email');
  };

  /* ---------------- render ---------------- */
  const codeField = (onSubmit: () => void) => (
    <TextField
      label="Verification code"
      icon="shield-key-outline"
      value={code}
      onChangeValue={setCode}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      returnKeyType="done"
      onSubmitEditing={onSubmit}
    />
  );
  const newPasswordField = (onSubmit: () => void) => (
    <TextField
      label="New password"
      icon="lock-reset"
      hint={rules.hint}
      value={newPassword}
      onChangeValue={setNewPassword}
      secureTextEntry
      autoCapitalize="none"
      autoComplete="new-password"
      textContentType="newPassword"
      returnKeyType="go"
      onSubmitEditing={onSubmit}
    />
  );

  const copy = COPY[step];
  const who = email.trim();

  return (
    <AuthLayout title={copy.title} subtitle={copy.subtitle(who)}>
      <View style={{ gap: spacing.md }}>
        {step === 'email' ? (
          <>
            <GoogleButton onError={setError} />
            <OrDivider />
            <AuthError message={error} />
            <TextField
              label="Email address"
              icon="email-outline"
              value={email}
              onChangeValue={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={submitEmail}
            />
            <Button title="Continue" icon="arrow-right" loading={busy} onPress={submitEmail} style={{ marginTop: spacing.xs }} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: spacing.sm }}>
              <AppText variant="subtitle">New to CropManager?</AppText>
              <TextLink title="Create an account" onPress={() => navigation.navigate('sign-up')} />
            </View>
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <AuthError message={error} />
            <TextField
              label="Password"
              icon="lock-outline"
              value={password}
              onChangeValue={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submitPassword}
            />
            <View style={{ alignItems: 'flex-end' }}>
              <TextLink title="Forgot password?" onPress={startReset} disabled={busy} />
            </View>
            <Button title="Sign in" icon="login" loading={busy} onPress={submitPassword} />
            <Button title="Use an email code instead" kind="secondary" icon="email-fast-outline" disabled={busy} onPress={() => run(sendEmailCode)} />
          </>
        ) : null}

        {step === 'email-code' ? (
          <>
            <AuthError message={error} />
            {codeField(submitEmailCode)}
            <Button title="Continue" icon="check" loading={busy} disabled={code.trim().length < 6} onPress={submitEmailCode} />
          </>
        ) : null}

        {step === 'second-factor' ? (
          <>
            <AuthError message={error} />
            {secondFactor?.strategy === 'totp' ? (
              <AppText variant="subtitle">Enter the 6-digit code from your authenticator app.</AppText>
            ) : null}
            {codeField(submitSecondFactor)}
            <Button title="Verify" icon="shield-check-outline" loading={busy} disabled={code.trim().length < 6} onPress={submitSecondFactor} />
          </>
        ) : null}

        {step === 'reset' ? (
          <>
            <AuthError message={error} />
            {codeField(submitReset)}
            {newPasswordField(submitReset)}
            <Button title="Reset password" icon="lock-check-outline" loading={busy} onPress={submitReset} />
          </>
        ) : null}

        {step === 'new-password' ? (
          <>
            <AuthError message={error} />
            {newPasswordField(submitNewPassword)}
            <Button title="Save and continue" icon="check" loading={busy} onPress={submitNewPassword} />
          </>
        ) : null}

        {step !== 'email' ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm }}>
            {step === 'email-code' || step === 'reset' || (step === 'second-factor' && secondFactor?.strategy === 'email_code') ? (
              <TextLink title="Resend code" onPress={resend} disabled={busy} />
            ) : null}
            <TextLink title="Use a different email" muted onPress={restart} />
          </View>
        ) : null}
      </View>
    </AuthLayout>
  );
}
