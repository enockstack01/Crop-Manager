import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius, spacing } from '../theme/theme';
import { useList, useProfile, useResourceMutations } from '../lib/useResource';
import { formatDate } from '../lib/format';
import { haptics } from '../lib/haptics';
import { Icon } from '../components/Icon';
import { AppText } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';

/** web .topbar-btn: 38px, radius 8, muted icon */
function TopbarButton({ icon, onPress, label, badge }: { icon: string; onPress: () => void; label: string; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? colors.bg : 'transparent',
      })}
    >
      <Icon name={icon} size={17} color={colors.textLight} />
      {badge ? (
        <View
          style={{
            position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
            backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontFamily: ff('700') }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The web app's .topbar: white bar with the menu button (phones), dark-mode toggle,
 * notifications bell with unread count, and the user's avatar. Page titles live in
 * the page body, as on the web.
 */
export function TopBar({ navigation, showMenu }: { navigation: any; showMenu: boolean }) {
  const { colors, isDark, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { profile } = useProfile();
  const toast = useToast();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data } = useList('notifications', { is_read: false, perPage: 10, sort: 'created_at', order: 'desc' });
  const notifs: any[] = data?.data ?? [];
  const { update } = useResourceMutations('notifications');

  const markAllRead = async () => {
    await Promise.all(notifs.map((n) => update.mutateAsync({ id: n.id, is_read: true })));
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast('All notifications marked as read', 'info');
  };

  const name = profile?.full_name || user?.fullName || 'User';
  const initials = (name.match(/\b\w/g) || ['U']).slice(0, 2).join('').toUpperCase();
  const avatar = profile?.avatar_url || (user?.hasImage ? user.imageUrl : null);

  return (
    <View
      style={{
        paddingTop: insets.top, backgroundColor: colors.card,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}
    >
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: 4 }}>
        {showMenu ? <TopbarButton icon="bars" label="Open menu" onPress={() => navigation.openDrawer()} /> : null}
        <View style={{ flex: 1 }} />
        <TopbarButton icon={isDark ? 'sun' : 'moon'} label="Toggle dark mode" onPress={() => setMode(isDark ? 'light' : 'dark')} />
        <TopbarButton icon="bell" label="Notifications" badge={notifs.length} onPress={() => setNotifOpen(true)} />
        <Pressable
          onPress={() => navigation.navigate('settings')}
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          style={({ pressed }) => ({ marginLeft: 6, borderRadius: 17, opacity: pressed ? 0.8 : 1 })}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
          ) : (
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.primary, fontFamily: ff('700'), fontSize: 14 }}>{initials}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Sheet visible={notifOpen} onClose={() => setNotifOpen(false)} title="Notifications" size="sm"
        footer={notifs.length ? (
          <Pressable onPress={markAllRead} hitSlop={8} accessibilityRole="button">
            <AppText weight="600" style={{ fontSize: 12, color: colors.primary }}>Mark all read</AppText>
          </Pressable>
        ) : undefined}
      >
        {notifs.length === 0 ? (
          <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg }}>No new notifications</AppText>
        ) : (
          notifs.map((n, i) => (
            <View
              key={n.id}
              style={{
                flexDirection: 'row', gap: 12, paddingBottom: 12,
                borderBottomWidth: i < notifs.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="bell" size={13} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 13 }}>{n.message || n.title}</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>{formatDate(n.created_at)}</AppText>
              </View>
            </View>
          ))
        )}
      </Sheet>
    </View>
  );
}
