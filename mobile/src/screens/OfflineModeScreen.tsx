import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { FOREST, ff } from '../theme/theme';
import { Icon } from '../components/Icon';
import { OfflineTools } from '../features/offline/OfflineTools';
import { t } from '../i18n';

/**
 * What the app shows while the phone has no internet and there is no saved account to open: the offline tools (scan a plant, ask a question),
 * using only the models stored on the phone. No sign-in is needed. It is a layer over the app, so the normal app comes back by itself when the
 * connection returns, exactly where it was. `onClose` is set when it was opened from the "connecting" screen and can be closed again.
 */
export function OfflineModeScreen({ onClose }: { onClose?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: FOREST, paddingTop: insets.top }}>
        <View style={{ minHeight: 64, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="cloud-off-outline" size={22} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 19, fontFamily: ff('700') }}>{t('Offline mode')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: ff('500') }}>{t('No internet. Sign in when you are online to use the whole app.')}</Text>
          </View>
          {onClose ? (
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close')} hitSlop={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="xmark" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <OfflineTools />
      </View>
    </View>
  );
}
