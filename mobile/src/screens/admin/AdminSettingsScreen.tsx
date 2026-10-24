import React, { useState } from 'react';
import { View } from 'react-native';
import { useAdminMutations, useAdminOrgMutations, useAdminOrgSettings, useAdminSettings } from '../../lib/adminApi';
import { reasonText } from '../../lib/orgApi';
import { formatNumber } from '../../lib/format';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Badge, ChartCard, EmptyState, KeyValue, Loading, PageHeader, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { NumberField, TextField } from '../../components/fields';
import { plain } from './bits';
import { t } from '../../i18n';

const uptime = (s?: number | null) => {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const ORG_FIELDS: [string, string][] = [
  ['referral_hours', 'Referral link validity (hours)'],
  ['default_max_farmers', 'Default farmer limit for new organizations'],
  ['default_max_uses', 'Default farmers per referral link'],
  ['inactive_days', 'Days without activity before a farmer counts as inactive'],
];

/** web System Settings: application and database health, organization defaults, administrator allowlist. */
export function AdminSettingsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, isError, refetch } = useAdminSettings();
  const { addAdmin, removeAdmin } = useAdminMutations();
  const { data: orgSettings } = useAdminOrgSettings();
  const { saveSettings } = useAdminOrgMutations();
  const [email, setEmail] = useState('');
  const [orgForm, setOrgForm] = useState<Record<string, any> | null>(null);
  const of: Record<string, any> = orgForm || orgSettings || { referral_hours: 6, default_max_farmers: 100, default_max_uses: 100, inactive_days: 30 };

  if (isLoading) return <Loading label="Loading system settings..." />;
  if (isError || !data) return <EmptyState icon="triangle-exclamation" title="Could not load settings" actionLabel="Try again" onAction={refetch} />;
  const { app, database, collection_counts: counts, admin_allowlist: allow } = data;

  const saveOrg = async () => {
    try { await saveSettings.mutateAsync(Object.fromEntries(Object.entries(of).map(([k, v]) => [k, Number(v)]))); toast(t('Organization settings saved')); setOrgForm(null); } catch (e: any) { toast(reasonText(e), 'error'); }
  };
  const add = async () => {
    try { await addAdmin.mutateAsync(email.trim()); toast(t('{{email}} added as administrator', { email: email.trim() })); setEmail(''); } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };
  const remove = async (addr: string) => {
    if (!(await confirm(plain(t('Remove {{email}} from the admin allowlist?', { email: addr })), { confirmLabel: 'Remove' }))) return;
    try { await removeAdmin.mutateAsync(addr); toast('Removed from allowlist'); } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };

  return (
    <Screen>
      <PageHeader title="System Settings" subtitle="Platform configuration and health." />
      <View style={{ gap: 20 }}>
        <ChartCard title={t('Application')} icon="server">
          <KeyValue label="Version">{app.version || '—'}</KeyValue>
          <KeyValue label="Environment">{app.env || '—'}</KeyValue>
          <KeyValue label="Node.js">{app.node || '—'}</KeyValue>
          <KeyValue label="Host">{app.host || '—'}</KeyValue>
          <KeyValue label="Uptime">{uptime(app.uptime_seconds)}</KeyValue>
        </ChartCard>

        <ChartCard title={t('Database')} icon="database">
          <KeyValue label="Name">{database.name || '—'}</KeyValue>
          <KeyValue label="Status">{database.state || '—'}</KeyValue>
          <KeyValue label="Collections">{String(database.collections ?? '—')}</KeyValue>
          <KeyValue label="Documents">{database.documents != null ? formatNumber(database.documents) : '—'}</KeyValue>
          <KeyValue label="Data size">{database.data_size_mb != null ? `${database.data_size_mb} MB` : '—'}</KeyValue>
          <KeyValue label="Storage size">{database.storage_size_mb != null ? `${database.storage_size_mb} MB` : '—'}</KeyValue>
        </ChartCard>

        <ChartCard title={t('Organization settings')} icon="building">
          <View style={{ gap: 12 }}>
            {ORG_FIELDS.map(([k, label]) => (
              <NumberField key={k} label={label} value={String(of[k] ?? '')} onChangeValue={(v) => setOrgForm({ ...of, [k]: v })} />
            ))}
            <View style={{ alignSelf: 'flex-start' }}><Button title="Save" loading={saveSettings.isPending} onPress={saveOrg} /></View>
          </View>
        </ChartCard>

        <ChartCard title={t('Administrator allowlist')} icon="user-shield">
          <AppText style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>{t("Anyone signing in with one of these emails is automatically granted admin. Env-configured entries are managed in the server settings and can't be removed here.")}</AppText>
          <View style={{ gap: 10, marginBottom: 14 }}>
            <TextField label="Email" value={email} onChangeValue={setEmail} placeholder="new.admin@example.com" keyboardType="email-address" />
            <View style={{ alignSelf: 'flex-start' }}><Button title="Add" icon="plus" loading={addAdmin.isPending} disabled={!email.trim()} onPress={add} /></View>
          </View>
          {allow.env.map((e: string) => (
            <View key={e} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
              <AppText style={{ fontSize: 13, flex: 1 }}>{e}</AppText><Badge label="env" tone="neutral" />
            </View>
          ))}
          {allow.managed.filter((e: string) => !allow.env.includes(e)).map((e: string) => (
            <View key={e} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
              <AppText style={{ fontSize: 13, flex: 1 }}>{e}</AppText>
              <Badge label="managed" tone="primary" />
              <Button title="Remove" size="sm" kind="danger" onPress={() => remove(e)} />
            </View>
          ))}
          {allow.env.length === 0 && allow.managed.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('No admins configured')}</AppText> : null}
        </ChartCard>

        <ChartCard title={t('Collection counts')} icon="layer-group">
          {Object.entries(counts as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <AppText style={{ fontSize: 13, color: colors.textLight }}>{k}</AppText>
              <AppText weight="700" style={{ fontSize: 13 }}>{formatNumber(n)}</AppText>
            </View>
          ))}
        </ChartCard>
      </View>
    </Screen>
  );
}
