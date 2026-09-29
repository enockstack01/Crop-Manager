import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useClerk, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius, shadow, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { PressableScale } from './PressableScale';
import { clerkMessage } from '../screens/auth/clerkHelpers';

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

const REDIRECT_URL = AuthSession.makeRedirectUri({ scheme: 'cropmanager', path: 'sso-callback' });

const sleep = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms));
const isReturnUrl = (url?: string | null) => !!url && url.startsWith(REDIRECT_URL);

/**
 * "Continue with Google" — Clerk OAuth in the system browser, for sign-in and sign-up
 * (Clerk signs an existing Google user in, or creates the account on first use).
 *
 * The web app gets this from Clerk's redirect flow, where the browser itself lands
 * back on the app. On Android the Custom Tab hands back through a deep link instead,
 * and expo-web-browser races "app became active" (reported as `dismiss`) against that
 * link, so a successful Google login is often reported as dismissed. This flow listens
 * for the return link itself, falls back to asking Clerk whether Google finished, and
 * also completes a sign-in whose return link relaunched the app.
 */
export function GoogleButton({ onError, label = 'Continue with Google' }: { onError: (msg: string) => void; label?: string }) {
  const { colors } = useTheme();
  const clerk = useClerk();
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [busy, setBusy] = useState(false);
  const handledLaunchUrl = useRef(false);

  // pre-launch the Custom Tab on Android so the sign-in sheet opens instantly
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    WebBrowser.warmUpAsync().catch(() => {});
    return () => {
      WebBrowser.coolDownAsync().catch(() => {});
    };
  }, []);

  /**
   * Finish the Google attempt: exchange the return link's nonce (when we have it),
   * create the account for first-time Google users, then activate the session.
   * Returns false when Google was not completed (the user backed out).
   */
  const finish = async (returnUrl: string | null): Promise<boolean> => {
    const current: any = clerk.client?.signIn ?? signIn;
    if (!current?.id) return false;
    const nonce = returnUrl ? new URL(returnUrl).searchParams.get('rotating_token_nonce') ?? '' : '';
    await current.reload(nonce ? { rotatingTokenNonce: nonce } : undefined);

    const verification = current.firstFactorVerification?.status;
    let sessionId: string | null = current.createdSessionId;
    if (!sessionId && verification === 'transferable') {
      // first time with this Google account: turn the sign-in into a new account
      const created = await signUp!.create({ transfer: true });
      sessionId = created.createdSessionId;
      if (!sessionId && created.status === 'missing_requirements') {
        throw new Error('Google did not share everything needed to create your account. Please sign up with email instead.');
      }
    }
    if (!sessionId) {
      if (!returnUrl && (verification === 'unverified' || !verification)) return false; // never finished Google
      throw new Error('Google sign-in did not complete. Please try again.');
    }
    haptics.success();
    await setActive!({ session: sessionId });
    return true;
  };

  // the Google return link relaunched the app (Android may kill it while the browser is open)
  useEffect(() => {
    if (!signInLoaded || !signUpLoaded || handledLaunchUrl.current) return;
    handledLaunchUrl.current = true;
    Linking.getInitialURL()
      .then(async (url) => {
        if (!isReturnUrl(url)) return;
        setBusy(true);
        try {
          await finish(url);
        } catch (e: any) {
          onError(clerkMessage(e, 'Google sign-in failed'));
        } finally {
          setBusy(false);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signInLoaded, signUpLoaded]);

  const onPress = async () => {
    if (!signInLoaded || !signUpLoaded || !signIn || !signUp) {
      onError('Sign-in is still starting up — please try again in a moment.');
      return;
    }
    setBusy(true);
    // catch the return link ourselves — it can arrive just after the browser reports "dismiss"
    let resolveLink: (url: string) => void = () => {};
    const linkArrived = new Promise<string>((r) => (resolveLink = r));
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isReturnUrl(url)) resolveLink(url);
    });
    try {
      // 1. ask Clerk for a Google sign-in attempt and the Google consent URL
      const attempt = await signIn.create({ strategy: 'oauth_google', redirectUrl: REDIRECT_URL });
      const googleUrl =
        attempt?.firstFactorVerification?.externalVerificationRedirectURL ||
        clerk.client?.signIn?.firstFactorVerification?.externalVerificationRedirectURL;
      if (!googleUrl) {
        throw new Error(`Google sign-in could not start (status: ${attempt?.status ?? 'none'}). Check your internet connection and try again.`);
      }

      // 2. Google consent in the system browser, which redirects back into the app
      const result = await WebBrowser.openAuthSessionAsync(googleUrl.toString(), REDIRECT_URL);
      const returnUrl =
        result.type === 'success' && result.url ? result.url : await Promise.race([linkArrived, sleep(3000)]);

      // 3. finish on the same sign-in (falls back to asking Clerk when no link was seen)
      await finish(returnUrl);
    } catch (e: any) {
      haptics.error();
      onError(clerkMessage(e, 'Google sign-in failed'));
    } finally {
      sub.remove();
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
        minHeight: 44,
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
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <GoogleG size={17} />}
      </View>
      <Text style={{ color: colors.text, fontFamily: ff('600'), fontSize: 13 }}>{label}</Text>
    </PressableScale>
  );
}
