import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText } from '../../components/ui';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import i18n, { t } from '../../i18n';

/**
 * The offline assistant's written note under an on-phone result: what is happening, the cause, what to do, how to prevent it and
 * when to ask for help. It runs on the phone (no internet). `auto` writes it as soon as the result is shown; otherwise a button asks.
 * Without the downloaded model it explains how to get it.
 */
export function OfflineNote({ result, notes = '', auto = false }: { result: any; notes?: string; auto?: boolean }) {
  const { colors } = useTheme();
  const nav = useContext(NavigationContext) as any; // none when shown outside the app's navigation
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<any>(null);
  const [error, setError] = useState('');
  const run = useRef(0);

  // the photo was not a plant the model knows, so there is nothing sensible to write about
  const usable = !!result && !result.unrecognised && result.predictions?.length > 0;

  const write = async () => {
    const me = ++run.current;
    setBusy(true);
    setError('');
    setNote(null);
    try {
      // loaded only when needed: it brings in the language-model code
      const { writeNote, noteLangFor } = await import('../../ml/assistant');
      const { labelNames } = await import('../../ml/crops');
      const lang = noteLangFor(i18n.language);
      const top = result.predictions[0];
      const others = result.predictions.slice(1).map((p: any) => {
        const n = labelNames(p.label, lang);
        return `${n.crop}: ${p.healthy ? 'healthy' : n.disease} ${Math.round(p.confidence * 100)}%`;
      });
      const n = await writeNote({ label: top.label, others, confident: !!result.confident, family: top.family, notes, lang });
      if (run.current === me) setNote(n);
    } catch (e: any) {
      if (run.current === me) setError(t('The offline assistant could not write the note. Close other apps and try again.'));
    } finally {
      if (run.current === me) setBusy(false);
    }
  };

  useEffect(() => {
    let live = true;
    import('../../ml/assistant')
      .then((m) => {
        if (!live) return;
        const ok = m.modelReady();
        setReady(ok);
        if (ok && auto && usable) write();
      })
      .catch(() => live && setReady(false));
    return () => { live = false; run.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!usable || ready === null) return null;

  const box = { marginTop: 12, gap: 10, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg } as const;

  if (!ready) {
    return (
      <View style={box}>
        <AppText weight="700" style={{ fontSize: 14 }}>{t('Get a written note without internet')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('Download the offline assistant once (about 770 MB, Wi-Fi recommended) and this phone can write a short treatment note by itself.')}</AppText>
        {nav ? (
          <Button title="Set up the offline assistant" icon="download" kind="secondary" onPress={() => nav.navigate('offline-assistant')} />
        ) : (
          <AppText variant="caption">{t('Open More, then Offline assistant, to set it up.')}</AppText>
        )}
      </View>
    );
  }

  if (!note && !busy) {
    return (
      <View style={box}>
        <Button title="Write a note" icon="wand-magic-sparkles" onPress={write} />
        {error ? <AppText style={{ fontSize: 13, color: colors.red }}>{error}</AppText> : null}
      </View>
    );
  }

  if (busy) {
    return (
      <View style={{ ...box, flexDirection: 'row', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="subtitle" style={{ flex: 1, fontSize: 13 }}>{t('Writing a note on this phone. This can take a minute…')}</AppText>
        <Button title="Stop" kind="ghost" size="sm" onPress={async () => { run.current += 1; setBusy(false); const m = await import('../../ml/assistant'); m.stopWriting(); }} />
      </View>
    );
  }

  const Section = ({ title, text, items }: { title: string; text?: string; items?: string[] }) =>
    (text || items?.length) ? (
      <View style={{ gap: 4 }}>
        <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(title)}</AppText>
        {text ? <AppText style={{ fontSize: 13, lineHeight: 20 }}>{text}</AppText> : null}
        {items?.map((x) => <AppText key={x} style={{ fontSize: 13, lineHeight: 20 }}>{`• ${x}`}</AppText>)}
      </View>
    ) : null;

  const englishOnly = i18n.language !== note.lang && i18n.language !== 'en';
  return (
    <View style={box}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="wand-magic-sparkles" size={13} color={colors.primary} />
        <AppText weight="700" style={{ fontSize: 14 }}>{t('Note from the offline assistant')}</AppText>
      </View>
      <Section title="What is happening" text={note.overview} />
      <Section title="Cause" text={note.cause} />
      <Section title="What to do" items={note.steps} />
      <Section title="How to prevent it" items={note.prevent} />
      <Section title="When to get expert help" text={note.help} />
      <AppText variant="caption">
        {t('Written on this phone by the offline assistant. It is small and can make mistakes: check with an extension officer.')}
        {englishOnly ? ` ${t('The note is written in English.')}` : ''}
      </AppText>
    </View>
  );
}
