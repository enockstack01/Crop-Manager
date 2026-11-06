import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, PageHeader, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Confirm';
import { t } from '../i18n';
import { MODEL, deleteModel, downloadModel, modelStatus, type ModelState } from '../ml/assistant';

const mb = (b: number) => `${Math.round(b / 1048576)} MB`;

/**
 * Get, check and remove the offline assistant. The model (769 MB) is not part of the app: it is downloaded here once, in pieces,
 * and can be continued after a dropped connection. Everything after that works without internet.
 */
export function OfflineAssistantScreen() {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const [status, setStatus] = useState<ModelState>(() => modelStatus());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => { abort.current?.abort(); deactivateKeepAwake('assistant-download'); }, []);

  const start = async () => {
    setError('');
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    activateKeepAwakeAsync('assistant-download').catch(() => {});
    try {
      await downloadModel({ signal: ctl.signal, onProgress: (have, total) => setStatus({ state: have >= total ? 'ready' : 'partial', have, total }) });
      setStatus(modelStatus());
    } catch (e: any) {
      setStatus(modelStatus());
      if (e?.message !== 'cancelled') setError(t('The download stopped. Check your connection and continue.'));
    } finally {
      setBusy(false);
      abort.current = null;
      deactivateKeepAwake('assistant-download');
    }
  };

  const remove = async () => {
    const ok = await confirm('Delete the offline assistant from this phone? You can download it again later.', { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    deleteModel();
    setStatus(modelStatus());
  };

  const pct = Math.round((status.have / status.total) * 100);
  const ready = status.state === 'ready';

  return (
    <Screen>
      <PageHeader title="Offline assistant" subtitle="A small assistant that lives on this phone. After a one-time download it writes a short treatment note from the leaf scan, with no internet." />

      <View style={{ gap: 12, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ready ? colors.primary : colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={ready ? 'circle-check' : 'download'} size={16} color={ready ? '#FFFFFF' : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="700" style={{ fontSize: 15 }}>
              {ready ? t('Ready on this phone') : status.state === 'partial' ? t('Download paused at {{pct}}%', { pct }) : t('Not downloaded')}
            </AppText>
            <AppText variant="caption">{ready ? mb(MODEL.bytes) : `${mb(status.have)} / ${mb(status.total)}`}</AppText>
          </View>
        </View>

        {busy || status.state === 'partial' ? (
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${Math.max(2, pct)}%`, backgroundColor: colors.primary }} />
          </View>
        ) : null}

        {error ? <AppText style={{ fontSize: 13, color: colors.red }}>{error}</AppText> : null}

        {!ready ? (
          busy ? (
            <Button title="Cancel" kind="secondary" onPress={() => abort.current?.abort()} />
          ) : (
            <Button title={status.state === 'partial' ? 'Continue download' : 'Download'} icon="download" onPress={start} />
          )
        ) : (
          <Button title="Delete from this phone" icon="trash" kind="secondary" onPress={remove} />
        )}
      </View>

      <View style={{ gap: 8, marginTop: 16 }}>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('Download size: about 770 MB. Use Wi-Fi if you can. You need about 1 GB of free storage and a phone with 3 GB of memory or more.')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('It writes in English or French. In other languages the note is written in English, next to the translated general advice.')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('It is a small model and can make mistakes, so use its notes as a guide and ask an extension officer about anything serious.')}</AppText>
        <AppText variant="caption">Gemma is provided under and subject to the Gemma Terms of Use: ai.google.dev/gemma/terms</AppText>
      </View>
    </Screen>
  );
}
