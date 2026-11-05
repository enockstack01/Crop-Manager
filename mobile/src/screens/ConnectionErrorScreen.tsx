import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useAuth } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/theme';
import { AppText } from '../components/ui';
import { Button } from '../components/Button';
import { ScanScreen } from './ScanScreen';

/**
 * Shown when the signed-in user's profile can't be loaded — replaces the old
 * endless "Loading your account…" spinner with the cause and a way out.
 */
export function ConnectionErrorScreen({ error, retrying, onRetry }: { error: any; retrying: boolean; onRetry: () => void }) {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const network = !!error?.network;
  const [scanning, setScanning] = useState(false);

  // the leaf scan runs on the phone, so it is offered here too: with no signal and nothing saved, it still works
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ padding: spacing.md, alignItems: 'flex-start' }}>
          <Button title="Back" icon="arrow-left" kind="ghost" onPress={() => setScanning(false)} />
        </View>
        <View style={{ flex: 1 }}><ScanScreen /></View>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
        padding: spacing.xl, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      <View
        style={{
          width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight,
          alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
        }}
      >
        <Icon name={network ? 'cloud-off-outline' : 'alert-circle-outline'} size={46} color={colors.primary} />
      </View>
      <AppText variant="title" style={{ fontSize: 22, textAlign: 'center' }}>
        {network ? "Can't reach CropManager" : 'Something went wrong'}
      </AppText>
      <AppText variant="subtitle" style={{ textAlign: 'center', marginTop: spacing.sm, maxWidth: 340 }}>
        {network
          ? "You're signed in, but we couldn't connect to CropManager. Check that your phone has an internet connection, then try again."
          : error?.message || 'Your account could not be loaded.'}
      </AppText>

      <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl, maxWidth: 420, width: '100%' }}>
        <Button title="Try again" icon="refresh" loading={retrying} onPress={onRetry} />
        {network ? <Button title="Scan a leaf on this phone" icon="leaf" kind="secondary" onPress={() => setScanning(true)} /> : null}
        <Button title="Sign out" kind="ghost" icon="logout" onPress={() => signOut()} />
      </View>
    </View>
  );
}
