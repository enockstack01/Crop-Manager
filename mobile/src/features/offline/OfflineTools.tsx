import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, Screen } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { OfflineChat } from '../ai/OfflineChat';
import { ScanScreen } from '../../screens/ScanScreen';
import { useModelDownload } from '../../ml/modelDownload';
import { offlineLlmSupported } from '../../ml/capability';
import { t } from '../../i18n';

type Page = 'home' | 'scan' | 'ask';

function BigCard({ icon, title, text, onPress }: { icon: string; title: string; text: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t(title)}. ${t(text)}`}
      style={({ pressed }) => ({ minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.primaryLight : colors.card })}
    >
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="700" style={{ fontSize: 17 }}>{t(title)}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 18, color: colors.textLight }}>{t(text)}</AppText>
      </View>
      <Icon name="chevron-right" size={14} color={colors.textLight} />
    </Pressable>
  );
}

/**
 * The tools that run on the phone with no internet: scan a plant and ask a question. A home page with two large cards, each opening its own page
 * with a clear way back. Used on its own screen inside the app (Tools > Offline tools) and as the page shown when the phone is offline and nobody
 * can be signed in.
 */
export function OfflineTools() {
  const { colors } = useTheme();
  const dl = useModelDownload();
  const [page, setPage] = useState<Page>('home');
  const canAsk = offlineLlmSupported();
  const pct = Math.round((dl.have / dl.total) * 100);

  if (page !== 'home') {
    return (
      <View style={{ flex: 1 }}>
        <Pressable onPress={() => setPage('home')} accessibilityRole="button" accessibilityLabel={t('Back to offline tools')} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Icon name="arrow-left" size={14} color={colors.primary} />
          <AppText weight="700" style={{ fontSize: 14, color: colors.primary }}>{t('Back to offline tools')}</AppText>
        </Pressable>
        <View style={{ flex: 1 }}>{page === 'scan' ? <ScanScreen /> : <OfflineChat />}</View>
      </View>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <AppText style={{ fontSize: 14, lineHeight: 20 }}>{t('These tools work on this phone with no internet. Your photos and questions never leave the phone.')}</AppText>
        <BigCard icon="leaf" title="Scan a plant" text="Photograph any part of a plant: leaf, stem, fruit, root or flower." onPress={() => setPage('scan')} />
        {canAsk ? <BigCard icon="comments" title="Ask a question" text="Type a farming question and read the answer written on this phone." onPress={() => setPage('ask')} /> : null}

        {canAsk ? (
          <View style={{ padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={dl.phase === 'ready' ? 'circle-check' : 'download'} size={14} color={colors.primary} />
              <AppText weight="700" style={{ fontSize: 14, flex: 1 }}>
                {dl.phase === 'ready' ? t('The offline assistant is ready') : dl.phase === 'downloading' ? t('Downloading the offline assistant: {{pct}}%', { pct }) : t('The offline assistant is not on this phone yet')}
              </AppText>
            </View>
            {dl.phase !== 'ready' ? (
              <AppText style={{ fontSize: 13, lineHeight: 19 }}>
                {dl.have > 0 && dl.phase !== 'downloading' ? t('The offline assistant download is paused at {{pct}}%. It continues by itself when you are back online.', { pct }) : t('It downloads by itself the next time you are online on Wi-Fi.')}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <AppText variant="caption">{t('When you are back online, everything you did in the app while offline is sent automatically.')}</AppText>
      </View>
    </Screen>
  );
}

/** The route inside the app (Tools > Offline tools). */
export function OfflineToolsScreen() {
  return <OfflineTools />;
}
