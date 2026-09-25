import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/theme';
import { AppText } from '../../components/ui';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';
import { GoogleButton } from '../../components/GoogleButton';
import { haptics } from '../../lib/haptics';
import { AuthError, AuthLayout, OrDivider } from './AuthLayout';

export function SignInScreen({ navigation }: any) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isLoaded) return;
    if (!email.trim() || !password) {
      haptics.warning();
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === 'complete') {
        haptics.success();
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError('This account needs an extra verification step. Use "Continue with Google" or finish signing in on the web app.');
      }
    } catch (e: any) {
      haptics.error();
      setError(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your farm management dashboard">
      <View style={{ gap: spacing.md }}>
        <GoogleButton onError={setError} />
        <OrDivider />
        <AuthError message={error} />
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
          value={password}
          onChangeValue={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Sign in" icon="login" loading={busy} onPress={submit} style={{ marginTop: spacing.xs }} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: spacing.sm }}>
          <AppText variant="subtitle">New to CropManager?</AppText>
          <Pressable onPress={() => { haptics.select(); navigation.navigate('sign-up'); }} hitSlop={8} accessibilityRole="link">
            <AppText weight="700" color={colors.primary}>Create an account</AppText>
          </Pressable>
        </View>
      </View>
    </AuthLayout>
  );
}
