import React, { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText } from '../../components/ui';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import i18n, { t } from '../../i18n';
import { useModelDownload } from '../../ml/modelDownload';
import { offlineLlmSupported } from '../../ml/capability';
import type { Turn } from '../../ml/assistant';

const SUGGESTIONS = ['How far apart should I plant maize?', 'How do I store beans so they do not spoil?', 'What can I do to keep my soil healthy?'];

/**
 * Ask the offline assistant a farming question. The question box sits at the TOP of the page, in the flow of the page, so it is never hidden by the
 * keyboard or pushed under the bottom of the screen; the answers are cards below it, newest first. It answers on the phone with the small model, in
 * short plain sentences, and never gives doses or product names (it sends the farmer to the extension officer for those).
 */
export function OfflineChat() {
  const { colors } = useTheme();
  const dl = useModelDownload();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const run = useRef(0);

  if (!offlineLlmSupported()) {
    return (
      <View style={{ padding: 16, gap: 8 }}>
        <AppText weight="700" style={{ fontSize: 15 }}>{t('Questions are not available on this phone')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('This phone has a 32-bit system, which the offline assistant does not support. Scanning a plant, your records and the online AI assistant still work.')}</AppText>
      </View>
    );
  }
  if (dl.phase !== 'ready') {
    return (
      <View style={{ padding: 16, gap: 8 }}>
        <AppText weight="700" style={{ fontSize: 15 }}>{t('The offline assistant is not on this phone yet')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('Questions need the offline assistant. Connect to the internet once, preferably on Wi-Fi: it downloads by itself.')}</AppText>
        <AppText variant="caption">{t('You can still scan a plant: that works without it.')}</AppText>
      </View>
    );
  }

  const ask = async (q: string) => {
    const asked = q.trim();
    if (!asked || busy) return;
    Keyboard.dismiss();
    const me = ++run.current;
    const history = turns;
    setQuestion(asked);
    setText('');
    setBusy(true);
    setError('');
    try {
      const { askOffline, noteLangFor } = await import('../../ml/assistant'); // loaded only when needed: it brings in the language-model code
      const answer = await askOffline(history, asked, noteLangFor(i18n.language));
      if (run.current === me) setTurns((cur) => [...cur, { role: 'user', content: asked }, { role: 'assistant', content: answer }]);
    } catch {
      if (run.current === me) setError(t('The offline assistant could not answer. Close other apps and try again.'));
    } finally {
      if (run.current === me) { setBusy(false); setQuestion(''); }
    }
  };

  const stop = async () => {
    run.current += 1;
    setBusy(false);
    setQuestion('');
    const m = await import('../../ml/assistant');
    m.stopWriting();
  };

  // question + answer pairs, newest first
  const pairs: { q: string; a: string }[] = [];
  for (let i = 0; i + 1 < turns.length; i += 2) pairs.unshift({ q: turns[i].content, a: turns[i + 1].content });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={{ padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 10 }}>
        <AppText weight="700" style={{ fontSize: 15 }}>{t('Ask a farming question')}</AppText>
        <AppText variant="caption">{t('The answer is written on this phone, with no internet.')}</AppText>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Type your question here')}
          placeholderTextColor={colors.textLight}
          editable={!busy}
          multiline
          maxLength={500}
          accessibilityLabel={t('Type your question here')}
          style={{ minHeight: 84, textAlignVertical: 'top', paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16, backgroundColor: colors.bg }}
        />
        <Button title="Ask" icon="paper-plane" loading={busy} disabled={busy || !text.trim()} onPress={() => ask(text)} />
      </View>

      {busy ? (
        <View style={{ padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 10 }}>
          <AppText weight="700" style={{ fontSize: 14 }}>{question}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="subtitle" style={{ flex: 1, fontSize: 13 }}>{t('Thinking on this phone. This can take a minute…')}</AppText>
          </View>
          <Button title="Stop" kind="secondary" size="sm" onPress={stop} />
        </View>
      ) : null}
      {error ? <AppText style={{ fontSize: 13, color: colors.red }}>{error}</AppText> : null}

      {pairs.length === 0 && !busy ? (
        <View style={{ gap: 8 }}>
          <AppText weight="700" style={{ fontSize: 13, color: colors.textLight }}>{t('Try one of these')}</AppText>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} onPress={() => ask(t(s))} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.primaryLight : colors.card })}>
              <Icon name="comments" size={14} color={colors.primary} />
              <AppText style={{ fontSize: 14, flex: 1 }}>{t(s)}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {pairs.map((p, i) => (
        <View key={`${pairs.length - i}`} style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' }}>
          <View style={{ padding: 12, backgroundColor: colors.primaryLight }}>
            <AppText weight="700" style={{ fontSize: 14 }}>{p.q}</AppText>
          </View>
          <View style={{ padding: 14 }}>
            <AppText style={{ fontSize: 14, lineHeight: 21 }}>{p.a}</AppText>
          </View>
        </View>
      ))}
      {pairs.length ? <AppText variant="caption">{t('Written on this phone by the offline assistant. It is small and can make mistakes: check with an extension officer.')}</AppText> : null}
    </ScrollView>
  );
}
