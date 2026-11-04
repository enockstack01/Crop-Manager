import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { AMBER, FOREST, ff } from '../theme/theme';
import { useProfile } from '../lib/useResource';
import { displayName } from '../lib/format';
import { haptics } from '../lib/haptics';
import { Icon } from '../components/Icon';
import { useLayout } from '../components/ui';
import { NotificationsSheet, useUnreadCount } from '../components/NotificationsSheet';
import { SearchSheet } from '../components/SearchSheet';
import { t } from '../i18n';
import { LanguageSheet } from '../components/LanguageSheet';

/** 48 px touch target with a white icon, for use on the forest app bar. */
function BarButton({ icon, onPress, label, badge }: { icon: string; onPress: () => void; label: string; badge?: number }) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={({ pressed }) => ({
        width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(255,255,255,0.14)' : 'transparent',
      })}
    >
      <Icon name={icon} size={19} color="#FFFFFF" />
      {badge ? (
        <View
          style={{
            position: 'absolute', top: 4, right: 3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
            backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#111611', fontSize: 12, lineHeight: 15, fontFamily: ff('700') }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export type LeftAction = 'none' | 'back' | 'close';

/**
 * App bar: solid forest green with the screen title, so you always know where you are. It has an
 * optional back button on the left, then search, the language switcher and the notification bell on
 * the right. On tablets, where the bottom tab bar is replaced by the side menu, it also holds the
 * dark mode button and the profile picture.
 */
export function TopBar({
  title,
  navigation,
  left = 'none',
  onLeft,
}: {
  title: string;
  navigation: any;
  left?: LeftAction;
  onLeft?: () => void;
}) {
  const { isDark, setMode } = useTheme();
  const { isTablet } = useLayout();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { profile } = useProfile();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const unread = useUnreadCount();

  const name = displayName(profile);
  const initials = (name.match(/w/g) || ['U']).slice(0, 2).join('').toUpperCase();
  const avatar = profile?.avatar_url || (user?.hasImage ? user.imageUrl : null);

  return (
    <View style={{ backgroundColor: FOREST }}>
      <View style={{ paddingTop: insets.top }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: left === 'none' ? 20 : 4, paddingRight: 4, gap: 2 }}>
          {left !== 'none' ? (
            <BarButton icon={left === 'close' ? 'xmark' : 'arrow-left'} label={left === 'close' ? 'Close' : 'Back'} onPress={() => onLeft?.()} />
          ) : null}
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flex: 1, color: '#FFFFFF', fontSize: 21, fontFamily: ff('700'), marginLeft: left === 'none' ? 0 : 4 }}
          >
            {t(title)}
          </Text>
          <BarButton icon="magnifying-glass" label={t('Search')} onPress={() => setSearchOpen(true)} />
          <BarButton icon="globe" label={t('Language')} onPress={() => setLangOpen(true)} />
          {isTablet ? <BarButton icon={isDark ? 'sun' : 'moon'} label="Toggle dark mode" onPress={() => setMode(isDark ? 'light' : 'dark')} /> : null}
          <BarButton icon="bell" label="Notifications" badge={unread} onPress={() => setNotifOpen(true)} />
          {isTablet ? (
            <Pressable
              onPress={() => navigation.navigate('settings')}
              accessibilityRole="button"
              accessibilityLabel="Profile settings"
              style={({ pressed }) => ({ marginHorizontal: 6, opacity: pressed ? 0.8 : 1 })}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: FOREST, fontFamily: ff('700'), fontSize: 14 }}>{initials}</Text>
                </View>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
      <SearchSheet visible={searchOpen} onClose={() => setSearchOpen(false)} navigation={navigation} />
      <NotificationsSheet visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}
