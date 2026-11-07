import React, { useEffect } from 'react';
import { View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, PageHeader, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Confirm';
import { t } from '../i18n';
import { MODEL } from '../ml/assistant';
import { cancelDownload, removeModel, setAutoDownload, startDownload, useModelDownload } from '../ml/modelDownload';

const mb = (b: number) => `${Math.round(b / 1048576)} MB`;

const WAITING: Record<string, string> = {
  offline: 'Waiting for the internet. It continues by itself when you are online.',
  mobile_data: 'Waiting for Wi-Fi, so your mobile data is not used. You can also download now on mobile data.',
  storage: 'There is not enough free storage on this phone. Free about 1.2 GB and it starts by itself.',
  memory: 'This phone does not have enough memory (about 3 GB) to run the offline assistant, so it is not downloaded.',
  off: 'The automatic download is switched off.',
  network: 'The download stopped because the connection dropped. It continues by itself.',
};

/**
 * Get, check and remove the offline assistant. The model (769 MB) is not part of the app: it downloads by itself when the app is first
 * opened on Wi-Fi, and this screen shows the progress and lets you stop it, switch the automatic download off, or download on mobile data.
 */
export function OfflineAssistantScreen() {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const dl = useModelDownload();
  const busy = dl.phase === 'downloading';
  const ready = dl.phase === 'ready';
  const pct = Math.round((dl.have / dl.total) * 100);

  // keep the screen on while a download is running here
  useEffect(() => {
    if (busy) activateKeepAwakeAsync('assistant-download').catch(() => {});
    return () => { deactivateKeepAwake('assistant-download'); };
  }, [busy]);

  const remove = async () => {
    const ok = await confirm('Delete the offline assistant from this phone? You can download it again later.', { confirmLabel: 'Delete', danger: true });
    if (ok) removeModel();
  };

  const title = ready ? t('Ready on this phone') : busy ? t('Downloading… {{pct}}%', { pct }) : dl.have > 0 ? t('Download paused at {{pct}}%', { pct }) : t('Not downloaded');
  const why = !ready && !busy ? WAITING[dl.reason] : '';

  return (
    <Screen>
      <PageHeader title="Offline assistant" subtitle="A small assistant that lives on this phone. It scans leaves and answers farming questions with no internet, and it is all you get when the phone is offline." />

      <View style={{ gap: 12, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ready ? colors.primary : colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={ready ? 'circle-check' : 'download'} size={16} color={ready ? '#FFFFFF' : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="700" style={{ fontSize: 15 }}>{title}</AppText>
            <AppText variant="caption">{ready ? mb(MODEL.bytes) : `${mb(dl.have)} / ${mb(dl.total)}`}</AppText>
          </View>
        </View>

        {busy || (!ready && dl.have > 0) ? (
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${Math.max(2, pct)}%`, backgroundColor: colors.primary }} />
          </View>
        ) : null}

        {why ? <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t(why)}</AppText> : null}

        {!ready ? (
          busy ? (
            <Button title="Stop" kind="secondary" onPress={cancelDownload} />
          ) : dl.reason === 'mobile_data' ? (
            <>
              <Button title="Download now on mobile data" icon="download" onPress={() => startDownload({ allowMetered: true })} />
            </>
          ) : (
            <Button title={dl.have > 0 ? 'Continue download' : 'Download'} icon="download" onPress={() => { setAutoDownload(true); startDownload(); }} />
          )
        ) : (
          <Button title="Delete from this phone" icon="trash" kind="secondary" onPress={remove} />
        )}
      </View>

      {!ready ? (
        <View style={{ marginTop: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, gap: 10 }}>
          <AppText weight="700" style={{ fontSize: 14 }}>{dl.auto ? t('Automatic download is on') : t('Automatic download is off')}</AppText>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('When the app is opened on Wi-Fi with enough free storage, the offline assistant downloads by itself. It never uses mobile data unless you choose to.')}</AppText>
          <Button title={dl.auto ? 'Switch automatic download off' : 'Switch automatic download on'} kind="secondary" size="sm" onPress={() => setAutoDownload(!dl.auto)} />
        </View>
      ) : null}

      <View style={{ gap: 8, marginTop: 16 }}>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('Download size: about 770 MB. You need about 1.2 GB of free storage and a phone with 3 GB of memory or more.')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('It writes in English or French. In other languages the note is written in English, next to the translated general advice.')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('It is a small model and can make mistakes, so use its notes as a guide and ask an extension officer about anything serious.')}</AppText>
        <AppText variant="caption">Gemma is provided under and subject to the Gemma Terms of Use: ai.google.dev/gemma/terms</AppText>
      </View>
    </Screen>
  );
}
