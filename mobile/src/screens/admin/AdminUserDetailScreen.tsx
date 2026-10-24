import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAdminMutations, useAdminUser, actionsFor, ACCOUNT_ACTIONS, RECORD_LABELS } from '../../lib/adminApi';
import { useProfile } from '../../lib/useResource';
import { displayName, formatDate, formatDateTime, formatNumber } from '../../lib/format';
import { USER_ROLES } from '../../lib/options';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, ChartCard, EmptyState, KeyValue, Loading, PageHeader, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { NumberField, SelectField } from '../../components/fields';
import { StatusPill, plain, useAccountActions } from './bits';
import { t } from '../../i18n';

/** web User detail: account, access control (admin, status, type, AI limit, re-seed, delete), request, data and activity. */
export function AdminUserDetailScreen({ route, navigation }: any) {
  const userId: string = route.params?.userId;
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile: me } = useProfile();
  const { data: u, isLoading, isError } = useAdminUser(userId);
  const { updateUser, removeUser, reseedUser } = useAdminMutations();
  const { start, dialog } = useAccountActions();
  const [limit, setLimit] = useState('');
  useEffect(() => { setLimit(u?.ai_daily_limit != null ? String(u.ai_daily_limit) : ''); }, [u?.ai_daily_limit]);

  if (isLoading) return <Loading />;
  if (isError || !u) return <EmptyState icon="triangle-exclamation" title="User not found" />;

  const isSelf = userId === me?.user_id;
  const patch = async (body: Record<string, any>, msg: string) => {
    try { await updateUser.mutateAsync({ userId, ...body }); toast(msg); } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };
  const del = async () => {
    if (!(await confirm(plain(t('Permanently delete {{name}} and all their data?', { name: u.full_name || u.email }))))) return;
    try { const res = await removeUser.mutateAsync(userId); toast(t('Deleted user and {{n}} records', { n: res.documents_removed })); navigation.goBack(); } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };
  const doReseed = async () => {
    if (!(await confirm(plain(t("Replace {{name}}'s data with a fresh demo dataset? Existing records are removed first.", { name: u.full_name || u.email })), { confirmLabel: 'Re-seed', danger: false }))) return;
    try { const res = await reseedUser.mutateAsync(userId); toast(t('Seeded {{n}} records', { n: res.total })); } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };

  const counts: Record<string, number> = u.counts || {};
  const totalRecords = Object.values(counts).reduce((s, n) => s + n, 0);
  const ar = u.access_request;

  return (
    <Screen>
      <PageHeader title={displayName(u)} subtitle={u.email || u.user_id} />
      <View style={{ gap: 20 }}>
        <ChartCard title={t('Account')} icon="id-card">
          <KeyValue label="Full name">{u.full_name || '—'}</KeyValue>
          <KeyValue label="Email">{u.email || '—'}</KeyValue>
          <KeyValue label="Account type">{u.role || '—'}</KeyValue>
          <KeyValue label="User ID">{u.public_id || '—'}</KeyValue>
          <KeyValue label="Currency">{u.currency || 'USD'}</KeyValue>
          <KeyValue label="Phone">{u.phone || '—'}</KeyValue>
          <KeyValue label="Location">{u.location || '—'}</KeyValue>
          <KeyValue label="Joined">{formatDate(u.created_at)}</KeyValue>
          <KeyValue label="Last seen">{u.last_seen_at ? formatDateTime(u.last_seen_at) : '—'}</KeyValue>
          <KeyValue label="Total records">{formatNumber(totalRecords)}</KeyValue>
        </ChartCard>

        <ChartCard title={t('Access control')} icon="user-shield">
          <View style={{ gap: 14 }}>
            <View style={{ gap: 6 }}>
              <AppText variant="label">{t('Administrator')}</AppText>
              <View style={{ alignSelf: 'flex-start' }}>
                <Button title={u.is_admin ? 'Revoke admin access' : 'Grant admin access'} kind={u.is_admin ? 'secondary' : 'primary'} disabled={isSelf} onPress={() => patch({ is_admin: !u.is_admin }, u.is_admin ? 'Admin revoked' : 'Admin granted')} />
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <AppText variant="label">{t('Account status')}</AppText>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusPill status={u.account_status} />
                {u.status_updated_at ? <AppText style={{ fontSize: 11, color: colors.textLight }}>{t('since {{date}}', { date: formatDateTime(u.status_updated_at) })}</AppText> : null}
              </View>
              {u.status_reason ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Note to user')}: {u.status_reason}</AppText> : null}
              {!isSelf && !u.is_admin ? (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {actionsFor(u.account_status).map((key) => (
                    <Button key={key} title={ACCOUNT_ACTIONS[key].label} icon={ACCOUNT_ACTIONS[key].icon} size="sm" kind={ACCOUNT_ACTIONS[key].kind} onPress={() => start(u, key)} />
                  ))}
                </View>
              ) : null}
              {u.is_admin ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Administrators always have access.')}</AppText> : null}
            </View>
            <SelectField label="Account type" value={u.role || 'Farmer'} onChangeValue={(v) => patch({ role: v }, 'Account type updated')} options={USER_ROLES} placeholder="" />
            <View style={{ gap: 8 }}>
              <NumberField label="AI requests per day" value={limit} onChangeValue={setLimit} placeholder={t('Platform default')} hint="Leave empty to use the platform default. 0 turns AI off for this user." />
              <View style={{ alignSelf: 'flex-start' }}>
                <Button title="Save limit" kind="secondary" size="sm" loading={updateUser.isPending} onPress={() => patch({ ai_daily_limit: limit.trim() === '' ? null : Number(limit) }, 'AI limit updated')} />
              </View>
            </View>
            <View style={{ gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-start' }}>
              <Button title="Re-seed demo data" icon="seedling" kind="secondary" loading={reseedUser.isPending} onPress={doReseed} />
              {!isSelf ? <Button title="Delete user & all data" icon="trash" kind="danger" onPress={del} /> : <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('You cannot change your own access here.')}</AppText>}
            </View>
          </View>
        </ChartCard>

        {ar ? (
          <ChartCard title={t('Account request')} icon="file-signature">
            <KeyValue label="Requested account type">{ar.account_type || '—'}</KeyValue>
            <KeyValue label="Farm / organisation">{ar.organization || '—'}</KeyValue>
            <KeyValue label="Country">{ar.country || '—'}</KeyValue>
            <KeyValue label="Farm size">{ar.farm_size != null ? `${formatNumber(ar.farm_size)} ${ar.farm_size_unit || ''}` : '—'}</KeyValue>
            <KeyValue label="Main crops">{ar.main_crops || '—'}</KeyValue>
            <KeyValue label="Sent">{formatDateTime(ar.submitted_at)}</KeyValue>
            <KeyValue label="Message">{ar.message || '—'}</KeyValue>
          </ChartCard>
        ) : null}

        <ChartCard title={t('Data breakdown')} icon="layer-group">
          {totalRecords === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('No records')}</AppText> : Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <AppText style={{ fontSize: 13, color: colors.textLight }}>{t(RECORD_LABELS[k] || k)}</AppText>
              <AppText weight="700" style={{ fontSize: 13 }}>{formatNumber(n)}</AppText>
            </View>
          ))}
        </ChartCard>

        <ChartCard title={t('Recent activity')} icon="clock-rotate-left">
          {(u.recent_harvests || []).map((h: any) => (
            <AppText key={h.id} style={{ fontSize: 13, paddingVertical: 6 }}>{t('Harvested {{qty}} kg {{crop}}', { qty: formatNumber(h.quantity), crop: h.crop_id?.name ? `· ${h.crop_id.name}` : '' })} · {formatDate(h.harvest_date)}</AppText>
          ))}
          {(u.recent_activities || []).map((a: any) => (
            <AppText key={a.id} style={{ fontSize: 13, paddingVertical: 6 }}>{a.activity_type} · {formatDate(a.activity_date)}</AppText>
          ))}
          {!(u.recent_harvests || []).length && !(u.recent_activities || []).length ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('No recent activity')}</AppText> : null}
        </ChartCard>
      </View>
      {dialog}
    </Screen>
  );
}
