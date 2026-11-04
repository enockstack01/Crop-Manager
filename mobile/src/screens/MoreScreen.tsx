import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { FOREST, ff, radius } from '../theme/theme';
import { AppText, Screen } from '../components/ui';
import { Icon } from '../components/Icon';
import { PressableScale } from '../components/PressableScale';
import { LanguageSheet } from '../components/LanguageSheet';
import { useConfirm } from '../components/Confirm';
import { useProfile } from '../lib/useResource';
import { displayName } from '../lib/format';
import { haptics } from '../lib/haptics';
import i18n, { LANGUAGES, t } from '../i18n';
import type { NavSection } from '../navigation/navConfig';

/** One tappable line: round icon, label, chevron. */
function Row({ icon, label, value, onPress, danger, last }: { icon: string; label: string; value?: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16,
        backgroundColor: pressed ? colors.primaryLight : 'transparent',
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#FFEBEE' : colors.primaryLight }}>
        <Icon name={icon} size={14} color={danger ? colors.red : colors.primary} />
      </View>
      <AppText weight="600" style={{ flex: 1, fontSize: 15, color: danger ? colors.red : colors.text }} numberOfLines={1}>{t(label)}</AppText>
      {value ? <AppText variant="subtitle" style={{ fontSize: 13 }} numberOfLines={1}>{value}</AppText> : null}
      {danger ? null : <Icon name="chevron-right" size={12} color={colors.textLight} />}
    </Pressable>
  );
}

/**
 * The phone's menu page (the 5th tab): your profile, every page of the app grouped as in the web
 * sidebar, language, dark mode and sign out.
 */
export function MoreScreen({ navigation, sections }: { navigation: any; sections: NavSection[] }) {
  const { colors, isDark, setMode } = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const confirm = useConfirm();
  const [langOpen, setLangOpen] = useState(false);
  const [badImage, setBadImage] = useState(false);

  const name = displayName(profile);
  const initials = (name.match(/\b\w/g) || ['U']).slice(0, 2).join('').toUpperCase();
  const avatar = profile?.avatar_url || (user?.hasImage ? user.imageUrl : null);
  const email = profile?.email || user?.primaryEmailAddress?.emailAddress || '';
  const langLabel = LANGUAGES.find((l) => l.code === i18n.language)?.label;

  const onSignOut = async () => {
    const ok = await confirm('Sign out of CropManager on this device?', { confirmLabel: 'Sign out', danger: true });
    if (ok) signOut();
  };

  // the home page and the tabs themselves are one tap away already, but listing them keeps this a full index
  const groups = sections.map((s) => ({ ...s, items: s.items }));

  return (
    <Screen contentStyle={{ gap: 16, paddingTop: 16 }}>
      {/* profile card */}
      <PressableScale
        onPress={() => navigation.navigate('settings')}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={t('Settings')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: FOREST, borderRadius: 20, padding: 18, overflow: 'hidden' }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)', top: -70, right: -40 }} />
        {avatar && !badImage ? (
          <Image source={{ uri: avatar }} onError={() => setBadImage(true)} style={{ width: 56, height: 56, borderRadius: 28 }} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: FOREST, fontFamily: ff('700'), fontSize: 20 }}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText weight="700" style={{ fontSize: 19, color: '#FFFFFF' }} numberOfLines={1}>{name}</AppText>
          {email ? <AppText style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>{email}</AppText> : null}
          {profile?.public_id ? <AppText weight="700" style={{ fontSize: 12, color: '#F9A825', marginTop: 2, letterSpacing: 0.5 }}>{profile.public_id}</AppText> : null}
        </View>
        <Icon name="chevron-right" size={14} color="#FFFFFF" />
      </PressableScale>

      {/* every page, grouped like the web sidebar */}
      {groups.map((section) => (
        <View key={section.label || 'root'}>
          {section.label ? (
            <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>{t(section.label)}</AppText>
          ) : null}
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {section.items.map((item, i) => (
              <Row key={item.route} icon={item.icon} label={item.label} last={i === section.items.length - 1} onPress={() => navigation.navigate(item.route)} />
            ))}
          </View>
        </View>
      ))}

      {/* preferences and sign out */}
      <View>
        <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>{t('Preferences')}</AppText>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <Row icon="globe" label="Language" value={langLabel} onPress={() => setLangOpen(true)} />
          <Row icon={isDark ? 'sun' : 'moon'} label={isDark ? 'Light mode' : 'Dark mode'} onPress={() => setMode(isDark ? 'light' : 'dark')} />
          <Row icon="right-from-bracket" label="Sign out" danger last onPress={onSignOut} />
        </View>
      </View>

      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </Screen>
  );
}
