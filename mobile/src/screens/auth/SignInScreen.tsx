import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/theme';
import { AppText, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';

export function SignInScreen({ navigation }: any) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isLoaded) return;
    setError('');
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError('Additional verification required. Please use the web app to finish signing in.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ gap: spacing.md }}>
          <AppText variant="title" style={{ textAlign: 'center' }}>CropManager</AppText>
          <AppText variant="subtitle" style={{ textAlign: 'center', marginBottom: spacing.md }}>Sign in to your account</AppText>

          {error ? (
            <View style={{ backgroundColor: '#FFEBEE', borderRadius: 8, padding: 10 }}>
              <AppText style={{ color: '#C62828' }}>{error}</AppText>
            </View>
          ) : null}

          <TextField
            label="Email"
            value={email}
            onChangeValue={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField label="Password" value={password} onChangeValue={setPassword} secureTextEntry autoCapitalize="none" />

          <Button title="Sign in" loading={busy} onPress={submit} />
          <Button title="Create an account" kind="ghost" onPress={() => navigation.navigate('sign-up')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
