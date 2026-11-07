import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { FOREST, ff } from '../theme/theme';
import { AppText } from '../components/ui';
import { Icon } from '../components/Icon';
import { OfflineChat } from '../features/ai/OfflineChat';
import { ScanScreen } from './ScanScreen';
import { useModelDownload } from '../ml/modelDownload';
import { offlineLlmSupported } from '../ml/capability';
import { t } from '../i18n';

/**
 * What the app shows while the phone has no internet: ONE service, the offline assistant (scan a leaf, ask a question), using only
 * the models stored on the phone. Everything that needs the internet is switched off, no sign-in is needed, and the normal app comes
 * back by itself when the connection returns (this screen is a layer over the app, so nothing the person was doing is lost).
 */
export function OfflineModeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dl = useModelDownload();
  const [tab, setTab] = useState<'scan' | 'ask'>('scan');
  const pct = Math.round((dl.have / dl.total) * 100);

  const Tab = ({ id, label, icon }: { id: 'scan' | 'ask'; label: string; icon: string }) => {
    const on = tab === id;
    return (
      <Pressable
        onPress={() => setTab(id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 3, borderBottomColor: on ? colors.primary : 'transparent' }}
      >
        <Icon name={icon} size={14} color={on ? colors.primary : colors.textLight} />
        <Text style={{ fontFamily: ff(on ? '700' : '500'), fontSize: 14, color: on ? colors.primary : colors.textLight }}>{t(label)}</Text>
      </Pressable>
    );
  };

  return (
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: FOREST, paddingTop: insets.top }}>
        <View style={{ minHeight: 64, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="cloud-off-outline" size={22} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 19, fontFamily: ff('700') }}>{t('Offline mode')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: ff('500') }}>{t('No internet. Only the offline assistant is on. CropManager comes back by itself when you are connected.')}</Text>
          </View>
        </View>
      </View>

      {dl.phase === 'downloading' ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primaryLight }}>
          <AppText style={{ fontSize: 12.5 }}>{t('Downloading the offline assistant: {{pct}}%', { pct })}</AppText>
        </View>
      ) : !offlineLlmSupported() ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primaryLight }}>
          <AppText style={{ fontSize: 12.5 }}>{t('This phone has a 32-bit system: you can scan leaves, but written notes and questions are not available.')}</AppText>
        </View>
      ) : dl.phase !== 'ready' ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primaryLight }}>
          <AppText style={{ fontSize: 12.5 }}>{dl.have > 0 ? t('The offline assistant download is paused at {{pct}}%. It continues by itself when you are back online.', { pct }) : t('The offline assistant is not on this phone yet. It downloads by itself the next time you are online on Wi-Fi.')}</AppText>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Tab id="scan" label="Scan a leaf" icon="leaf" />
        <Tab id="ask" label="Ask a question" icon="comments" />
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'scan' ? <ScanScreen /> : <OfflineChat />}
      </View>
    </View>
  );
}
