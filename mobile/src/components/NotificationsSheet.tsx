import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useList } from '../lib/useResource';
import { formatDate } from '../lib/format';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { AppText } from './ui';
import { useToast } from './Toast';
import { t } from '../i18n';

const TYPE_ICON: Record<string, string> = { warning: 'triangle-exclamation', alert: 'triangle-exclamation', success: 'circle-check', error: 'circle-exclamation' };

/** How many unread notifications there are (the whole count, not just the page shown). */
export function useUnreadCount() {
  const { data } = useList('notifications', { is_read: false, perPage: 1 });
  return data?.total ?? 0;
}

/**
 * The notifications list: the latest 20, unread ones highlighted with a dot. Tapping one marks it
 * read; "Mark all as read" clears every unread notification with a single request, updating the
 * list and the bell badge at once and putting them back if the request fails.
 */
export function NotificationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const unread = useUnreadCount();
  const { data, isLoading, isError, refetch } = useList('notifications', { perPage: 20, sort: 'created_at', order: 'desc' }, { enabled: visible });
  const items: any[] = data?.data ?? [];
  const [busy, setBusy] = useState(false);

  /** Applies a change to every cached notifications list (the bell count and this list), returning the old values to undo it. */
  const patch = (fn: (row: any) => any, countDelta: (n: number) => number) => {
    const before = qc.getQueriesData<any>({ queryKey: ['notifications', 'list'] });
    qc.setQueriesData<any>({ queryKey: ['notifications', 'list'] }, (old: any) => {
      if (!old?.data) return old;
      const rows = old.data.map(fn);
      const unreadOnly = old.perPage === 1; // the badge query holds only unread rows and its total
      return { ...old, data: unreadOnly ? rows.filter((r: any) => !r.is_read) : rows, total: unreadOnly ? countDelta(old.total ?? 0) : old.total };
    });
    return () => before.forEach(([key, value]) => qc.setQueryData(key, value));
  };

  const markAll = async () => {
    if (busy || !unread) return;
    haptics.select();
    setBusy(true);
    const undo = patch((r) => ({ ...r, is_read: true }), () => 0);
    try {
      await api.put('/notifications/read-all');
      toast('All notifications marked as read', 'info');
    } catch {
      undo();
      toast('Could not mark the notifications as read. Try again.', 'error');
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const markOne = (n: any) => {
    if (n.is_read) return;
    haptics.select();
    const undo = patch((r) => (r.id === n.id ? { ...r, is_read: true } : r), (c) => Math.max(0, c - 1));
    api.put(`/notifications/${n.id}`, { is_read: true })
      .catch(() => undo())
      .finally(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Notifications"
      size="sm"
      footer={unread > 0 ? (
        <Pressable
          onPress={markAll}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('Mark all as read')}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: radius.pill,
            backgroundColor: pressed ? colors.primaryLight : 'transparent', opacity: busy ? 0.6 : 1,
          })}
        >
          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="check-double" size={14} color={colors.primary} />}
          <AppText weight="700" style={{ fontSize: 14, color: colors.primary }}>{t('Mark all as read')} ({unread > 99 ? '99+' : unread})</AppText>
        </Pressable>
      ) : undefined}
    >
      {isLoading ? (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <AppText variant="subtitle" style={{ fontSize: 14, textAlign: 'center' }}>{t('Could not load notifications.')}</AppText>
          <Pressable onPress={() => refetch()} accessibilityRole="button" hitSlop={8}>
            <AppText weight="700" style={{ fontSize: 14, color: colors.primary }}>{t('Try again')}</AppText>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell-slash" size={22} color={colors.primary} />
          </View>
          <AppText weight="700" style={{ fontSize: 15 }}>{t("You're all caught up")}</AppText>
          <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center' }}>{t('No new notifications')}</AppText>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => markOne(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n.is_read ? '' : `${t('Unread')}. `}${n.title || ''} ${n.message || ''}`}
              accessibilityHint={n.is_read ? undefined : t('Marks it as read')}
              style={{
                flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1,
                borderColor: n.is_read ? colors.border : colors.primary,
                backgroundColor: n.is_read ? 'transparent' : colors.primaryLight,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: n.is_read ? colors.bg : colors.card, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={TYPE_ICON[n.type] || 'bell'} size={14} color={n.is_read ? colors.textLight : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                {n.title ? <AppText weight={n.is_read ? '600' : '700'} style={{ fontSize: 14 }}>{n.title}</AppText> : null}
                {n.message ? <AppText style={{ fontSize: 13, lineHeight: 19, color: n.is_read ? colors.textLight : colors.text }}>{n.message}</AppText> : null}
                <AppText variant="caption" style={{ marginTop: 3 }}>{formatDate(n.created_at)}</AppText>
              </View>
              {n.is_read ? null : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4 }} />}
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}
