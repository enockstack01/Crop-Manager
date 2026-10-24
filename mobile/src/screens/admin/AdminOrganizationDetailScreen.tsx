import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAdminOrg, useAdminOrgMutations } from '../../lib/adminApi';
import { reasonText } from '../../lib/orgApi';
import { formatDateTime } from '../../lib/format';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { ff, radius } from '../../theme/theme';
import { AppText, Badge, ChartCard, EmptyState, KeyValue, Loading, PageHeader, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { NumberField, TextField } from '../../components/fields';
import { ORG_TONE } from './AdminOrganizationsScreen';
import { plain } from './bits';
import { t } from '../../i18n';

const LINK_TONE: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = { active: 'success', expired: 'neutral', revoked: 'danger', full: 'warning' };
const RESULT: Record<string, string> = {
  joined: 'Joined', not_registered: 'No account with this email', already_member: 'Already a member', other_org: 'In another organization',
  org_limit: 'Limit reached', limit_reached: 'Not tried, limit reached', invalid_email: 'Not an email address', not_a_farmer: 'Not a farmer account', error: 'Error',
};

/** web Organization detail: approve / suspend / reactivate / delete, farmer limit, team, links, import farmers, history. */
export function AdminOrganizationDetailScreen({ route, navigation }: any) {
  const id: string = route.params?.orgId;
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: o, isLoading, isError } = useAdminOrg(id);
  const { patch, remove, importFarmers } = useAdminOrgMutations();
  const [limit, setLimit] = useState('');
  const [reason, setReason] = useState('');
  const [csv, setCsv] = useState('');
  const [consent, setConsent] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [suspending, setSuspending] = useState(false);
  const [why, setWhy] = useState('');

  if (isLoading) return <Loading />;
  if (isError || !o) return <EmptyState icon="triangle-exclamation" title="Organization not found" />;

  const act = async (body: Record<string, any>, ok: string) => {
    try {
      await patch.mutateAsync({ id, ...body });
      toast(t(ok));
      if (body.max_farmers !== undefined) { setReason(''); setLimit(''); }
    } catch (err: any) { toast(reasonText(err), 'error'); }
  };
  const del = async () => {
    if (!(await confirm(plain(t('Delete {{name}}? Its farmers are unlinked (their data stays with them), its links stop working and its team loses access.', { name: o.name })), { confirmLabel: t('Delete') }))) return;
    try { await remove.mutateAsync(id); toast(t('Organization deleted')); navigation.goBack(); } catch (err: any) { toast(reasonText(err), 'error'); }
  };
  const runImport = async () => {
    try { setReport(await importFarmers.mutateAsync({ id, csv, consent_confirmed: consent })); toast(t('Import finished')); } catch (err: any) { toast(reasonText(err), 'error'); }
  };
  const pct = o.max_farmers ? Math.min(100, Math.round((o.farmer_count / o.max_farmers) * 100)) : 0;

  return (
    <Screen>
      <PageHeader title={o.name} subtitle={`${t(o.type)} · ${[o.district, o.country].filter(Boolean).join(', ')}`} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <Badge label={o.status} tone={ORG_TONE[o.status] || 'neutral'} />
        {o.status === 'pending' ? <Button title="Approve" icon="check" onPress={() => act({ action: 'approve' }, 'Organization approved')} /> : null}
        {o.status === 'active' ? <Button title="Suspend" icon="ban" kind="secondary" onPress={() => { setWhy(''); setSuspending(true); }} /> : null}
        {o.status === 'suspended' ? <Button title="Reactivate" icon="rotate-left" onPress={() => act({ action: 'reactivate' }, 'Organization reactivated')} /> : null}
        <Button title="Delete" icon="trash" kind="danger" onPress={del} />
      </View>

      <View style={{ gap: 20 }}>
        <ChartCard title={t('Farmer limit')} icon="gauge">
          <AppText style={{ fontSize: 13, marginBottom: 6 }}>{o.farmer_count} / {o.max_farmers} ({pct}%)</AppText>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 14 }}>
            <View style={{ width: `${pct}%`, height: 8, backgroundColor: pct >= 100 ? colors.red : colors.primary }} />
          </View>
          <View style={{ gap: 10 }}>
            <NumberField label="New limit" value={limit} onChangeValue={setLimit} placeholder={String(o.max_farmers)} />
            <TextField label="Reason (recorded in the audit log)" value={reason} onChangeValue={setReason} />
            <View style={{ alignSelf: 'flex-start' }}>
              <Button title="Save limit" loading={patch.isPending} disabled={limit === '' || !reason.trim()} onPress={() => act({ max_farmers: Number(limit), reason }, 'Farmer limit updated')} />
            </View>
            <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Lowering the limit below the current number keeps existing farmers but blocks new ones.')}</AppText>
          </View>
        </ChartCard>

        <ChartCard title={t('Details')} icon="building">
          <KeyValue label="Contact email">{o.contact_email || '—'}</KeyValue>
          <KeyValue label="Contact phone">{o.contact_phone || '—'}</KeyValue>
          <KeyValue label="Sector">{o.sector || '—'}</KeyValue>
          <KeyValue label="Registered">{formatDateTime(o.created_at)}</KeyValue>
          <KeyValue label="Approved">{o.approved_at ? formatDateTime(o.approved_at) : '—'}</KeyValue>
          <KeyValue label="Suspended because">{o.suspended_reason || '—'}</KeyValue>
        </ChartCard>

        <ChartCard title={t('Team')} icon="users">
          {o.members.length ? o.members.map((m: any) => (
            <View key={m.id} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <AppText style={{ fontSize: 13, flex: 1 }}><AppText weight="700" style={{ fontSize: 13 }}>{m.name || m.email}</AppText>{m.name ? ` ${m.email}` : ''}</AppText>
              <Badge label={`${t(m.role === 'org_admin' ? 'Administrator' : 'Field officer')}${m.status === 'invited' ? ` · ${t('Invited')}` : ''}`} tone="neutral" />
            </View>
          )) : <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('No team members yet.')}</AppText>}
        </ChartCard>

        <ChartCard title={t('Referral links')} icon="link">
          {o.links.length ? o.links.map((l: any) => (
            <View key={l.id} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <AppText style={{ fontSize: 13, flex: 1 }}>{l.label || t('Referral link')} <AppText style={{ fontSize: 11, color: colors.textLight }}>{formatDateTime(l.created_at)} · {l.use_count}{l.max_uses ? `/${l.max_uses}` : ''}</AppText></AppText>
              <Badge label={l.status} tone={LINK_TONE[l.status] || 'neutral'} />
            </View>
          )) : <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('No links yet.')}</AppText>}
        </ChartCard>

        <ChartCard title={t('Add existing farmers by email')} icon="file-import">
          <AppText style={{ fontSize: 12, color: colors.textLight, marginBottom: 8 }}>{t('Paste one email per line (or a CSV with an email column). The farmers must already have a CropManager account. The farmer limit applies.')}</AppText>
          <TextInput
            value={csv}
            onChangeText={setCsv}
            multiline
            autoCapitalize="none"
            placeholder={'email\nfarmer@example.com'}
            placeholderTextColor={colors.placeholder}
            style={{ minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, color: colors.text, fontSize: 13, fontFamily: ff('400'), textAlignVertical: 'top', backgroundColor: colors.input }}
          />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginVertical: 12 }}>
            <Button title={consent ? 'Agreed' : 'Confirm consent'} icon={consent ? 'square-check' : 'square'} kind="secondary" size="sm" onPress={() => setConsent(!consent)} />
            <AppText style={{ flex: 1, fontSize: 12, color: colors.textLight }}>{t('I confirm these farmers have agreed to share a summary of their crop activity with this organization.')}</AppText>
          </View>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button title={importFarmers.isPending ? 'Importing…' : 'Import farmers'} loading={importFarmers.isPending} disabled={!csv.trim() || !consent || o.status !== 'active'} onPress={runImport} />
          </View>
          {report ? (
            <View style={{ marginTop: 12, gap: 4 }}>
              <AppText weight="700" style={{ fontSize: 13 }}>{t('{{count}} farmers joined.', { count: report.joined })}</AppText>
              {report.rows.filter((r: any) => r.result !== 'joined').slice(0, 50).map((r: any, i: number) => (
                <AppText key={i} style={{ fontSize: 12 }}>{r.email}: <AppText style={{ fontSize: 12, color: colors.textLight }}>{t(RESULT[r.result] || r.result)}</AppText></AppText>
              ))}
            </View>
          ) : null}
        </ChartCard>

        <ChartCard title={t('Recent history')} icon="clipboard-list">
          {o.audit.length ? o.audit.map((a: any) => (
            <View key={a.id} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <AppText weight="700" style={{ fontSize: 13 }}>{a.action} <AppText style={{ fontSize: 12, color: colors.textLight }}>{a.actor}</AppText></AppText>
              <AppText style={{ fontSize: 11, color: colors.textLight }}>{formatDateTime(a.created_at)}</AppText>
            </View>
          )) : <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Nothing recorded yet.')}</AppText>}
        </ChartCard>
      </View>

      <Sheet
        visible={suspending}
        onClose={() => setSuspending(false)}
        title="Suspend"
        size="sm"
        footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Button title="Cancel" kind="secondary" onPress={() => setSuspending(false)} /><Button title="Suspend" icon="ban" onPress={async () => { setSuspending(false); await act({ action: 'suspend', reason: why }, 'Organization suspended'); }} /></View>}
      >
        <TextField label={t('Why is {{name}} being suspended?', { name: o.name })} value={why} onChangeValue={setWhy} />
      </Sheet>
    </Screen>
  );
}
