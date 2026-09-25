import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { API_URL } from '../env';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText } from '../components/ui';
import { Button } from '../components/Button';

/**
 * Shown when the signed-in user's profile can't be loaded — replaces the old
 * endless "Loading your account…" spinner with the cause and a way out.
 */
export function ConnectionErrorScreen({ error, retrying, onRetry }: { error: any; retrying: boolean; onRetry: () => void }) {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const network = !!error?.network;

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
        <MaterialCommunityIcons name={network ? 'cloud-off-outline' : 'alert-circle-outline'} size={46} color={colors.primary} />
      </View>
      <AppText variant="title" style={{ fontSize: 22, textAlign: 'center' }}>
        {network ? "Can't reach CropManager" : 'Something went wrong'}
      </AppText>
      <AppText variant="subtitle" style={{ textAlign: 'center', marginTop: spacing.sm, maxWidth: 340 }}>
        {network
          ? 'Your account is signed in, but the CropManager server did not respond. Check that your phone is online (on the same Wi-Fi as the server) and that the server is running.'
          : error?.message || 'Your account could not be loaded.'}
      </AppText>

      {network ? (
        <View
          style={{
            marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
            borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
          }}
        >
          <AppText variant="caption" style={{ fontFamily: 'monospace' }}>{API_URL}</AppText>
        </View>
      ) : null}

      <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl, maxWidth: 420, width: '100%' }}>
        <Button title="Try again" icon="refresh" loading={retrying} onPress={onRetry} />
        <Button title="Sign out" kind="ghost" icon="logout" onPress={() => signOut()} />
      </View>
    </View>
  );
}
