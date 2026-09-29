import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/theme';
import { AppText } from '../../components/ui';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';
import { GoogleButton } from '../../components/GoogleButton';
import { useToast } from '../../components/Toast';
import { haptics } from '../../lib/haptics';
import { AuthError, AuthLayout, OrDivider } from './AuthLayout';
import { clerkMessage, usePasswordRules } from './clerkHelpers';

export function SignUpScreen({ navigation }: any) {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { colors } = useTheme();
  const toast = useToast();
  const rules = usePasswordRules();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPending] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!isLoaded) return;
    if (!email.trim() || !password) {
      haptics.warning();
      setError('Enter an email and a password.');
      return;
    }
    const problem = rules.check(password);
    if (problem) {
      haptics.warning();
      setError(problem);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      haptics.success();
      setPending(true);
    } catch (e: any) {
      haptics.error();
      setError(clerkMessage(e, 'Sign up failed'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!isLoaded) return;
    setError('');
    setBusy(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        haptics.success();
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError('Verification incomplete — check the code and try again.');
      }
    } catch (e: any) {
      haptics.error();
      setError(clerkMessage(e, 'Verification failed'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
      toast('A new code is on its way', 'info');
    } catch (e: any) {
      setError(clerkMessage(e, 'Could not resend the code'));
    }
  };

  if (pendingVerification) {
    return (
      <AuthLayout title="Check your email" subtitle={`Enter the 6-digit code we sent to ${email.trim()}`}>
        <View style={{ gap: spacing.md }}>
          <AuthError message={error} />
          <TextField
            label="Verification code"
            icon="shield-key-outline"
            value={code}
            onChangeValue={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={verify}
          />
          <Button title="Verify & continue" icon="check" loading={busy} disabled={code.trim().length < 6} onPress={verify} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm }}>
            <Pressable onPress={resend} hitSlop={8} accessibilityRole="button">
              <AppText weight="700" color={colors.primary}>Resend code</AppText>
            </Pressable>
            <Pressable onPress={() => { setPending(false); setCode(''); setError(''); }} hitSlop={8} accessibilityRole="button">
              <AppText weight="600" color={colors.textLight}>Change email</AppText>
            </Pressable>
          </View>
        </View>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start managing your crop production today">
      <View style={{ gap: spacing.md }}>
        <GoogleButton onError={setError} label="Sign up with Google" />
        <OrDivider />
        <AuthError message={error} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField label="First name" hint="Optional" value={firstName} onChangeValue={setFirstName} autoComplete="given-name" textContentType="givenName" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Last name" hint="Optional" value={lastName} onChangeValue={setLastName} autoComplete="family-name" textContentType="familyName" />
          </View>
        </View>
        <TextField
          label="Email"
          icon="email-outline"
          value={email}
          onChangeValue={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          icon="lock-outline"
          hint={rules.hint}
          value={password}
          onChangeValue={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={start}
        />
        <Button title="Create account" icon="account-plus-outline" loading={busy} onPress={start} style={{ marginTop: spacing.xs }} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: spacing.sm }}>
          <AppText variant="subtitle">Already have an account?</AppText>
          <Pressable onPress={() => { haptics.select(); navigation.navigate('sign-in'); }} hitSlop={8} accessibilityRole="link">
            <AppText weight="700" color={colors.primary}>Sign in</AppText>
          </Pressable>
        </View>
      </View>
    </AuthLayout>
  );
}
