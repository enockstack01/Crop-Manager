import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText } from '../../components/ui';
import { Icon } from '../../components/Icon';
import i18n, { t } from '../../i18n';
import { useModelDownload } from '../../ml/modelDownload';
import type { Turn } from '../../ml/assistant';
import { offlineLlmSupported } from '../../ml/capability';

const SUGGESTIONS = ['How far apart should I plant maize?', 'How do I store beans so they do not spoil?', 'What can I do to keep my soil healthy?'];

/**
 * Ask the offline assistant a farming question. It answers on the phone with the small model, in short plain sentences, and never gives
 * doses or product names (it sends the farmer to the extension officer for those). Without the downloaded model it explains how to get it.
 */
export function OfflineChat() {
  const { colors } = useTheme();
  const dl = useModelDownload();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef<ScrollView>(null);
  const run = useRef(0);

  if (!offlineLlmSupported()) {
    return (
      <View style={{ padding: 20, gap: 8 }}>
        <AppText weight="700" style={{ fontSize: 15 }}>{t('Questions are not available on this phone')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('This phone has a 32-bit system, which the offline assistant does not support.')}</AppText>
        <AppText variant="caption">{t('You can still scan a leaf: that works without internet.')}</AppText>
      </View>
    );
  }

  if (dl.phase !== 'ready') {
    return (
      <View style={{ padding: 20, gap: 8 }}>
        <AppText weight="700" style={{ fontSize: 15 }}>{t('The offline assistant is not on this phone yet')}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('Questions need the offline assistant. Connect to the internet once, preferably on Wi-Fi: it downloads by itself.')}</AppText>
        <AppText variant="caption">{t('You can still scan a leaf: that works without it.')}</AppText>
      </View>
    );
  }

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const me = ++run.current;
    const history = turns;
    setTurns([...history, { role: 'user', content: question }]);
    setText('');
    setBusy(true);
    setError('');
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { askOffline, noteLangFor } = await import('../../ml/assistant'); // loaded only when needed: it brings in the language-model code
      const answer = await askOffline(history, question, noteLangFor(i18n.language));
      if (run.current === me) setTurns((cur) => [...cur, { role: 'assistant', content: answer }]);
    } catch {
      if (run.current === me) setError(t('The offline assistant could not answer. Close other apps and try again.'));
    } finally {
      if (run.current === me) { setBusy(false); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }
    }
  };

  const stop = async () => {
    run.current += 1;
    setBusy(false);
    const m = await import('../../ml/assistant');
    m.stopWriting();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {turns.length === 0 ? (
          <View style={{ gap: 8 }}>
            <AppText style={{ fontSize: 14, lineHeight: 20 }}>{t('Ask a farming question. The answer is written on this phone, with no internet.')}</AppText>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => ask(t(s))} accessibilityRole="button" style={({ pressed }) => ({ padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.primaryLight : colors.card })}>
                <AppText style={{ fontSize: 14 }}>{t(s)}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {turns.map((m, i) => (
          <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: 12, borderRadius: radius.lg, backgroundColor: m.role === 'user' ? colors.primary : colors.card, borderWidth: m.role === 'user' ? 0 : 1, borderColor: colors.border }}>
            <AppText style={{ fontSize: 14, lineHeight: 20, color: m.role === 'user' ? '#FFFFFF' : colors.text }}>{m.content}</AppText>
          </View>
        ))}
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 }}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="subtitle" style={{ flex: 1, fontSize: 13 }}>{t('Thinking on this phone. This can take a minute…')}</AppText>
            <Pressable onPress={stop} accessibilityRole="button" hitSlop={8}><AppText weight="700" style={{ fontSize: 13, color: colors.primary }}>{t('Stop')}</AppText></Pressable>
          </View>
        ) : null}
        {error ? <AppText style={{ fontSize: 13, color: colors.red }}>{error}</AppText> : null}
        {turns.length ? <AppText variant="caption">{t('Written on this phone by the offline assistant. It is small and can make mistakes: check with an extension officer.')}</AppText> : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Type your question')}
          placeholderTextColor={colors.textLight}
          editable={!busy}
          multiline
          maxLength={500}
          onSubmitEditing={() => ask(text)}
          style={{ flex: 1, minHeight: 48, maxHeight: 110, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 15, backgroundColor: colors.bg }}
        />
        <Pressable
          onPress={() => ask(text)}
          disabled={busy || !text.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('Send')}
          style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: busy || !text.trim() ? colors.border : colors.primary }}
        >
          <Icon name="paper-plane" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
