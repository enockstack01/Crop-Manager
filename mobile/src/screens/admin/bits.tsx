import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { AppText, Badge } from '../../components/ui';
import { TextAreaField } from '../../components/fields';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { ff, radius } from '../../theme/theme';
import { ACCOUNT_ACTIONS, STATUS_META, useAdminMutations } from '../../lib/adminApi';
import { t } from '../../i18n';

/** Strips the simple HTML the web confirm dialogs use. */
export const plain = (s: string) => s.replace(/<[^>]+>/g, '');

export function StatusPill({ status }: { status?: string }) {
  const m = STATUS_META[status || 'new'] || STATUS_META.new;
  return <Badge label={m.label} tone={m.tone} />;
}

/** Horizontal filter chips. */
export function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onChange(o.id)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: value === o.id ? colors.primaryDark : colors.border, backgroundColor: value === o.id ? colors.primaryDark : colors.card }}
        >
          <AppText weight="600" style={{ fontSize: 12, color: value === o.id ? '#fff' : colors.text }}>{t(o.label)}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, minHeight: 42, marginBottom: 12 }}>
      <Icon name="magnifying-glass" size={13} color={colors.placeholder} />
      <TextInput value={value} onChangeText={onChange} placeholder={t(placeholder)} placeholderTextColor={colors.placeholder} autoCapitalize="none" style={{ flex: 1, paddingVertical: 8, color: colors.text, fontSize: 13, fontFamily: ff('400') }} />
    </View>
  );
}

/** A tappable list row: title, subtitle lines and something on the right. */
export function ListRow({ title, lines, right, onPress, last }: { title: React.ReactNode; lines?: (string | undefined | null | false)[]; right?: React.ReactNode; onPress?: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, backgroundColor: pressed ? colors.bg : 'transparent' })}>
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? <AppText weight="700" style={{ fontSize: 13 }}>{title}</AppText> : title}
        {(lines || []).filter(Boolean).map((l, i) => <AppText key={i} style={{ fontSize: 12, color: colors.textLight }}>{l as string}</AppText>)}
      </View>
      {right}
      {onPress ? <Icon name="chevron-right" size={12} color={colors.textLight} /> : null}
    </Pressable>
  );
}

export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const { colors } = useTheme();
  if (totalPages <= 1) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
      <Button title="Previous" kind="secondary" size="sm" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      <AppText style={{ fontSize: 12, color: colors.textLight }}>{page} / {totalPages}</AppText>
      <Button title="Next" kind="secondary" size="sm" disabled={page >= totalPages} onPress={() => onChange(page + 1)} />
    </View>
  );
}

/**
 * Confirm-and-run for account status changes. `start(user, key)` opens a dialog (with an optional note for
 * the user on reject / hold / deactivate); render `dialog` somewhere in the screen.
 */
export function useAccountActions() {
  const toast = useToast();
  const { updateUser } = useAdminMutations();
  const [pending, setPending] = useState<{ user: any; key: string } | null>(null);
  const [reason, setReason] = useState('');

  const close = () => setPending(null);
  const start = (user: any, key: string) => { setReason(''); setPending({ user, key }); };
  const run = async () => {
    if (!pending) return;
    const a = ACCOUNT_ACTIONS[pending.key];
    try {
      await updateUser.mutateAsync({ userId: pending.user.user_id, account_status: a.status, reason: reason.trim() });
      toast(a.done);
      close();
    } catch (e: any) {
      toast(e?.message || 'Failed', 'error');
    }
  };
  const a = pending ? ACCOUNT_ACTIONS[pending.key] : null;
  const name = pending ? pending.user.full_name || pending.user.email || pending.user.user_id : '';
  const dialog = (
    <Sheet
      visible={!!pending}
      onClose={close}
      title={a ? `${t(a.label)}` : ''}
      size="sm"
      footer={a ? (
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button title="Cancel" kind="secondary" onPress={close} />
          <Button title={a.label} icon={a.icon} kind={a.kind} loading={updateUser.isPending} onPress={run} />
        </View>
      ) : undefined}
    >
      {a ? (
        <View style={{ gap: 12 }}>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>
            {t('{{action}} the account of {{name}}?', { action: t(a.label), name })}{' '}
            {a.status === 'active' ? t('They will be able to use the dashboard straight away.') : t('They will no longer be able to open the dashboard.')}{' '}
            {t('They are notified of the change.')}
          </AppText>
          {a.reason ? <TextAreaField label="Note to the user (optional)" value={reason} onChangeValue={setReason} placeholder="e.g. We need more details about your farm" /> : null}
        </View>
      ) : null}
    </Sheet>
  );
  return { start, dialog };
}
