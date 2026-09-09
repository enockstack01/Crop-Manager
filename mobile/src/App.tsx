import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkLoaded, ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';

import { CLERK_PUBLISHABLE_KEY } from './env';
import { tokenCache } from './lib/tokenCache';
import { setTokenGetter } from './lib/api';
import { useProfile } from './lib/useResource';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Confirm';
import { Loading } from './components/ui';
import { AppNavigator } from './navigation/AppNavigator';
import { AuthNavigator } from './navigation/AuthNavigator';
import { OnboardingScreen } from './screens/OnboardingScreen';

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

function RootGate() {
  const { profile, isLoading } = useProfile();
  if (isLoading) return <Loading label="Loading your account…" />;
  if (profile && !profile.onboarded) return <OnboardingScreen profile={profile} />;
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
        <AuthNavigator />
      </SignedOut>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <ThemeProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    <ApiTokenBridge />
                    <NavRoot />
                  </ConfirmProvider>
                </ToastProvider>
              </ThemeProvider>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
