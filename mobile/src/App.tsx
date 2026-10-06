import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resourceCache } from '@clerk/clerk-expo/resource-cache';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import { useTranslation } from 'react-i18next';
import { CLERK_PUBLISHABLE_KEY } from './env';
import { setLanguage } from './i18n';
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
import { AccountGateScreen } from './screens/AccountGateScreen';
import { setCurrency } from './lib/format';
import { ConnectionErrorScreen } from './screens/ConnectionErrorScreen';
import { OfflineBanner } from './components/OfflineBanner';
import { useToast } from './components/Toast';
import { onSyncFailure, setSyncUser, startOfflineSupport } from './lib/offline';
import { t } from './i18n';

const WEEK = 7 * 24 * 60 * 60 * 1000;

// data is kept on the phone (AsyncStorage) for a week so the app opens without signal
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000, gcTime: WEEK } },
});
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'cropmanager-cache' });
startOfflineSupport(queryClient);

/** Bridges Clerk's session token into the axios instance (set during render,
 * before any query fires — mirrors the web client's main.jsx). */
function ApiTokenBridge() {
  const { getToken, isSignedIn, userId } = useAuth();
  const toast = useToast();
  setTokenGetter(() => getToken());

  // offline changes sync only for the person who made them; signing out clears the saved data
  useEffect(() => {
    setSyncUser(isSignedIn && userId ? userId : null);
    if (isSignedIn === false) queryClient.clear();
  }, [isSignedIn, userId]);

  useEffect(() => onSyncFailure((msg) => toast(`${t('A change made offline could not be saved:')} ${msg}`, 'error', 6000)), [toast]);
  return null;
}

/**
 * Signed-in entry: loads the profile, then routes to the access request / status
 * page (accounts not approved yet), onboarding (admins), or the app. The
 * splash stays up while this resolves; a server that can't be reached now ends in
 * a Retry screen instead of an endless spinner.
 */
function RootGate() {
  const { profile, isLoading, isFetching, isError, error, refetch } = useProfile();
  const splashReady = useSplashReady();

  useEffect(() => {
    if (!isLoading) splashReady();
  }, [isLoading, splashReady]);

  // the language saved on the profile (chosen on any device) wins over this device's
  useEffect(() => {
    if (profile?.language) setLanguage(profile.language);
  }, [profile?.language]);

  // the splash covers the first seconds; if the server is still waking up after it
  // fades, say so instead of showing a blank screen
  if (isLoading) return <Loading label="Connecting to CropManager…" />;
  if (isError || !profile) {
    return <ConnectionErrorScreen error={error} retrying={isFetching} onRetry={() => refetch()} />;
  }
  if (!profile.is_admin && profile.account_status !== 'active') {
    return <AccountGateScreen profile={profile} onRefresh={() => refetch()} refreshing={isFetching} />;
  }
  if (!profile.onboarded) return <OnboardingScreen profile={profile} />;
  // the default currency pre-fills new records (each record keeps its own currency)
  setCurrency(profile.currency);
  return <AppNavigator />;
}

function NavRoot() {
  const { isDark, colors } = useTheme();
  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.primary } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.border, primary: colors.primary } };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
  // every screen re-renders in a newly chosen language (navigation restarts on the dashboard)
  const { i18n } = useTranslation();
  // only visible if the splash times out first (e.g. no internet to reach Clerk)
  if (!isLoaded) return <Loading label="Connecting to CropManager…" />;
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: WEEK, buster: 'v1' }}>
      <ToastProvider>
        <ConfirmProvider>
          <ApiTokenBridge />
          <NavRoot key={i18n.language} />
          <OfflineBanner />
        </ConfirmProvider>
      </ToastProvider>
    </PersistQueryClientProvider>
  );
}

export default function App() {
  // Inter, the web app's typeface; the splash covers the moment it takes to load
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const ready = fontsLoaded || !!fontError;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SplashHost>
            {/* rethrow: clerk-js otherwise treats every failed request on native as "offline" and
                returns null, hiding the real error (e.g. the Google sign-in start) */}
            {ready ? (
              <ClerkProvider
                publishableKey={CLERK_PUBLISHABLE_KEY}
                tokenCache={tokenCache}
                experimental={{ rethrowOfflineNetworkErrors: true }}
                // lets Clerk start from its cached session without signal (offline use)
                __experimental_resourceCache={resourceCache}
              >
                <AppShell />
              </ClerkProvider>
            ) : null}
          </SplashHost>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
