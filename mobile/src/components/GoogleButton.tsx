import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useSSO } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { PressableScale } from './PressableScale';

// lets the browser hand the OAuth result back to the app when it redirects
WebBrowser.maybeCompleteAuthSession();

function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * "Continue with Google" — Clerk OAuth in the system browser. Works for both sign-in
 * and sign-up: Clerk signs an existing user in or creates the account on first use.
 * The redirect (cropmanager://sso-callback) is on the Clerk instance's allowlist.
 */
export function GoogleButton({ onError, label = 'Continue with Google' }: { onError: (msg: string) => void; label?: string }) {
  const { colors } = useTheme();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);

  // pre-launch the Custom Tab on Android so the sign-in sheet opens instantly
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    WebBrowser.warmUpAsync().catch(() => {});
    return () => {
      WebBrowser.coolDownAsync().catch(() => {});
    };
  }, []);

  const onPress = async () => {
    setBusy(true);
    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'cropmanager', path: 'sso-callback' }),
      });
      if (createdSessionId && setActive) {
        haptics.success();
        await setActive({ session: createdSessionId });
      } else if (signUp?.status === 'missing_requirements') {
        onError('Google did not share everything needed to create your account. Please sign up with email instead.');
      }
      // otherwise the user closed the browser — nothing to do
    } catch (e: any) {
      onError(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 50,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        opacity: busy ? 0.7 : 1,
        ...shadow(1),
      }}
    >
      <View style={{ width: 20, alignItems: 'center' }}>
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <GoogleG />}
      </View>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </PressableScale>
  );
}
