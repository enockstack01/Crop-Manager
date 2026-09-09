import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { spacing } from '../../theme/theme';
import { AppText, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';

export function SignUpScreen({ navigation }: any) {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPending] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!isLoaded) return;
    setError('');
    setBusy(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPending(true);
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || 'Sign up failed');
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
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError('Verification incomplete.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ gap: spacing.md }}>
          <AppText variant="title" style={{ textAlign: 'center' }}>Create account</AppText>

          {error ? (
            <View style={{ backgroundColor: '#FFEBEE', borderRadius: 8, padding: 10 }}>
              <AppText style={{ color: '#C62828' }}>{error}</AppText>
            </View>
          ) : null}

          {pendingVerification ? (
            <>
              <AppText variant="subtitle" style={{ textAlign: 'center' }}>
                Enter the verification code sent to {email}
              </AppText>
              <TextField label="Verification code" value={code} onChangeValue={setCode} keyboardType="number-pad" />
              <Button title="Verify & continue" loading={busy} onPress={verify} />
            </>
          ) : (
            <>
              <TextField
                label="Email"
                value={email}
                onChangeValue={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextField label="Password" value={password} onChangeValue={setPassword} secureTextEntry autoCapitalize="none" />
              <Button title="Continue" loading={busy} onPress={start} />
              <Button title="I already have an account" kind="ghost" onPress={() => navigation.navigate('sign-in')} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
