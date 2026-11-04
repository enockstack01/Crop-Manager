import React from 'react';
import { Pressable } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import i18n, { LANGUAGES, setLanguage } from '../i18n';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { AppText } from './ui';

/** The language list (opened from the app bar on tablets and from More on phones). */
export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const pick = (code: string) => {
    // keep the cached profile in step, or the app would switch straight back
    qc.setQueryData(['profile'], (p: any) => (p ? { ...p, language: code } : p));
    api.put('/profile', { language: code }).catch(() => {});
    setLanguage(code);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Language" size="sm">
      {LANGUAGES.map((l) => (
        <Pressable
          key={l.code}
          onPress={() => pick(l.code)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, minHeight: 48, borderRadius: 12, backgroundColor: pressed ? colors.bg : 'transparent' })}
        >
          <Icon name={i18n.language === l.code ? 'circle-check' : 'circle'} size={16} color={i18n.language === l.code ? colors.primary : colors.textLight} />
          <AppText weight={i18n.language === l.code ? '700' : '400'} style={{ fontSize: 15 }}>{l.label}</AppText>
        </Pressable>
      ))}
    </Sheet>
  );
}
