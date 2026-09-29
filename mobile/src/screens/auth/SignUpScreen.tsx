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
import { AuthError, AuthLayout, AuthSwitch, OrDivider, TextLink } from './AuthLayout';
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
      <AuthLayout
        heading="Create your account"
        intro="Start managing your crop production today"
        title="Verify your email"
        subtitle={`Enter the verification code sent to ${email.trim()}`}
      >
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
            <TextLink title="Resend code" onPress={resend} />
            <TextLink title="Change email" muted onPress={() => { setPending(false); setCode(''); setError(''); }} />
          </View>
        </View>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Create your account"
      intro="Start managing your crop production today"
      title="Create your account"
      subtitle="Welcome! Please fill in the details to get started."
      footer={<AuthSwitch prompt="Already have an account?" action="Sign in" onPress={() => navigation.navigate('sign-in')} />}
    >
      <View style={{ gap: spacing.md }}>
        <GoogleButton onError={setError} />
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
          label="Email address"
          value={email}
          onChangeValue={setEmail}
          placeholder="Enter your email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label="Password"
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
        <Button title="Continue" icon="arrow-right" loading={busy} onPress={start} style={{ marginTop: spacing.xs }} />
      </View>
    </AuthLayout>
  );
}
