import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';

import { CLERK_PUBLISHABLE_KEY } from './env';
import { tokenCache } from './lib/tokenCache';
import { setTokenGetter } from './lib/api';
import { useProfile } from './lib/useResource';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Confirm';
import { Loading } from './components/ui';
import { SplashHost, SplashReadyOnMount, useSplashReady } from './components/AppSplash';
import { AppNavigator } from './navigation/AppNavigator';
import { AuthNavigator } from './navigation/AuthNavigator';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ConnectionErrorScreen } from './screens/ConnectionErrorScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

/** Bridges Clerk's session token into the axios instance (set during render,
 * before any query fires — mirrors the web client's main.jsx). */
function ApiTokenBridge() {
  const { getToken } = useAuth();
  setTokenGetter(() => getToken());
  return null;
}

/**
 * Signed-in entry: loads the profile, then routes to onboarding or the app. The
 * splash stays up while this resolves; a server that can't be reached now ends in
 * a Retry screen instead of an endless spinner.
 */
function RootGate() {
  const { profile, isLoading, isFetching, isError, error, refetch } = useProfile();
  const splashReady = useSplashReady();

  useEffect(() => {
    if (!isLoading) splashReady();
  }, [isLoading, splashReady]);

  // the splash covers the first seconds; if the server is still waking up after it
  // fades, say so instead of showing a blank screen
  if (isLoading) return <Loading label="Connecting to CropManager…" />;
  if (isError || !profile) {
    return <ConnectionErrorScreen error={error} retrying={isFetching} onRetry={() => refetch()} />;
  }
  if (!profile.onboarded) return <OnboardingScreen profile={profile} />;
  return <AppNavigator />;
}

function NavRoot() {
  const { isDark, colors } = useTheme();
  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.primary } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.primary } };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <SignedIn>
        <RootGate />
      </SignedIn>
      <SignedOut>
        <SplashReadyOnMount />
        <AuthNavigator />
      </SignedOut>
    </NavigationContainer>
  );
}

/** Mounts the app once Clerk has restored the session (the splash covers the wait). */
function AppShell() {
  const { isLoaded } = useAuth();
  // only visible if the splash times out first (e.g. no internet to reach Clerk)
  if (!isLoaded) return <Loading label="Connecting to CropManager…" />;
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <ApiTokenBridge />
          <NavRoot />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SplashHost>
            {/* rethrow: clerk-js otherwise treats every failed request on native as "offline" and
                returns null, hiding the real error (e.g. the Google sign-in start) */}
            <ClerkProvider
              publishableKey={CLERK_PUBLISHABLE_KEY}
              tokenCache={tokenCache}
              experimental={{ rethrowOfflineNetworkErrors: true }}
            >
              <AppShell />
            </ClerkProvider>
          </SplashHost>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
