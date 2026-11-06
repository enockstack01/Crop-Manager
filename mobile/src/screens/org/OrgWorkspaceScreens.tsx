import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, Badge, ChartCard, EmptyState, Loading, PageHeader, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { formatDate, formatDateTime } from '../../lib/format';
import { reasonText, useFarmerRecords, useOrgActivity, useOrgInvites, useOrgMutations } from '../../lib/orgApi';
import { OrgGate } from './OrgGate';
import { t } from '../../i18n';

/* Mirrors client/src/pages/org/OrgWorkspace.jsx: invitations, one farmer's crop records, and the activity log. */

const Card = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  return <View style={{ padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, gap: 4 }}>{children}</View>;
};

/* ------------------------------------------------------------- invitations */
const STATUS: Record<string, [string, string]> = { invited: ['warning', 'Waiting'], joined: ['success', 'Joined'], revoked: ['neutral', 'Cancelled'], expired: ['danger', 'Expired'] };
const RESULT: Record<string, string> = {
  joined: 'Linked now', invited: 'Invitation emailed', invited_test: 'Invitation saved (test mode, no email sent)', invite_not_sent: 'Saved, but the email could not be sent',
  invalid_email: 'Not an email address', not_a_farmer: 'Not a farmer account', already_member: 'Already a member', other_org: 'Belongs to another organization', org_limit: 'Farmer limit reached', limit_reached: 'Farmer limit reached',
};

function InvitesBody({ org }: { org: any }) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useOrgInvites(org.id, status);
  const { inviteFarmers, resendInvite, revokeInvite } = useOrgMutations(org.id);
  const [emails, setEmails] = useState('');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<any>(null);
  const counts = data?.counts || {};

  const send = async () => {
    try { setResult(await inviteFarmers.mutateAsync({ emails, consent_confirmed: consent })); setEmails(''); } catch (err) { toast(reasonText(err), 'error'); }
  };
  const resend = async (i: any) => { try { await resendInvite.mutateAsync(i.id); toast(t('Invitation sent again')); } catch (err) { toast(reasonText(err), 'error'); } };
  const revoke = async (i: any) => {
    if (!(await confirm(t('Cancel the invitation to {{email}}?', { email: i.email }), { confirmLabel: 'Cancel invitation', danger: true }))) return;
    try { await revokeInvite.mutateAsync(i.id); toast(t('Invitation cancelled')); } catch (err) { toast(reasonText(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Invitations" subtitle="Invite farmers by email. People without an account get a sign-up email and join your organization when they sign in." />
      <ChartCard title="Invite farmers" icon="paper-plane">
        <TextField label="Email addresses (one per line, or separated by commas)" value={emails} onChangeValue={setEmails} multiline keyboardType="email-address" autoCapitalize="none" placeholder="farmer@example.com" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Switch value={consent} onValueChange={setConsent} />
          <AppText style={{ flex: 1, fontSize: 12 }}>{t('These farmers have agreed to share a summary of their crop activity with {{org}}.', { org: org.name })}</AppText>
        </View>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button title="Send invitations" icon="paper-plane" loading={inviteFarmers.isPending} disabled={!consent || !emails.trim() || org.status !== 'active'} onPress={send} />
        </View>
      </ChartCard>
      {result ? (
        <View style={{ marginTop: 12 }}>
          <Card>
            <AppText weight="700" style={{ fontSize: 13 }}>{t('{{joined}} linked, {{invited}} invited', { joined: result.joined, invited: result.invited })}</AppText>
            {result.rows.map((r: any) => <AppText key={r.email} style={{ fontSize: 12, color: colors.textLight }}>{`${r.email}: ${t(RESULT[r.result] || r.result)}`}</AppText>)}
          </Card>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 }}>
        {['', 'invited', 'expired', 'joined', 'revoked'].map((s) => (
          <Button key={s || 'all'} size="sm" kind={status === s ? 'primary' : 'secondary'} title={s ? `${t(STATUS[s][1])} (${counts[s] || 0})` : 'All'} onPress={() => setStatus(s)} />
        ))}
      </View>
      {isLoading ? <Loading /> : !data?.data?.length ? (
        <EmptyState icon="envelope" title="No invitations" description="Invitations you send appear here with their status." />
      ) : (
        <View style={{ gap: 10 }}>
          {data.data.map((i: any) => (
            <Card key={i.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <AppText weight="700" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{i.email}</AppText>
                <Badge label={t(STATUS[i.status][1])} tone={STATUS[i.status][0] as any} />
              </View>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>
                {i.sent_count ? `${t('Sent')} ${i.sent_count}× · ${formatDateTime(i.last_sent_at)}` : t('Not sent yet')} · {i.status === 'joined' ? formatDate(i.joined_at) : `${t('Expires')} ${formatDate(i.expires_at)}`}
              </AppText>
              {i.email_error ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('The email could not be sent')}</AppText> : null}
              {i.status === 'invited' || i.status === 'expired' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Button title="Send again" size="sm" kind="secondary" icon="paper-plane" onPress={() => resend(i)} />
                  {i.status === 'invited' ? <Button title="Cancel invitation" size="sm" kind="secondary" icon="ban" onPress={() => revoke(i)} /> : null}
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </>
  );
}
export function OrgInvitesScreen() { return <Screen><OrgGate>{(p: any) => <InvitesBody {...p} />}</OrgGate></Screen>; }

/* ------------------------------------------------------------ farmer records */
function Section({ title, empty, lines }: { title: string; empty: string; lines: string[] }) {
  const { colors } = useTheme();
  return (
    <ChartCard title={title} icon="seedling">
      {lines.length ? lines.map((l, i) => <AppText key={i} style={{ fontSize: 13, marginBottom: 4 }}>{l}</AppText>) : <AppText style={{ fontSize: 13, color: colors.textLight }}>{t(empty)}</AppText>}
    </ChartCard>
  );
}

function FarmerBody({ org, route }: { org: any; route: any }) {
  const farmerId = route?.params?.farmerId || '';
  const { data, isLoading, isError } = useFarmerRecords(org.id, farmerId);
  if (isLoading) return <Loading />;
  if (isError || !data) return <EmptyState icon="triangle-exclamation" title="Could not load this farmer" description="The farmer may have left your organization." />;
  const none = 'Nothing recorded yet.';
  return (
    <>
      <PageHeader title={data.farmer.name} subtitle={[data.farmer.location, data.farmer.phone, data.farmer.email].filter(Boolean).join(' · ')} />
      <AppText style={{ fontSize: 12, marginBottom: 12 }}>{t('Crop records only. Money, stock and equipment are never shared with an organization.')}</AppText>
      <View style={{ gap: 12 }}>
        <Section title="Farms" empty={none} lines={data.farms.map((f: any) => `${f.name}${f.district ? ` · ${f.district}` : ''} · ${f.hectares} ha`)} />
        <Section title="Crops in the field" empty={none} lines={data.cycles.map((c: any) => `${c.crop} · ${t(c.status)} · ${c.hectares} ha${c.expected_harvest_date ? ` · ${t('harvest')} ${formatDate(c.expected_harvest_date)}` : ''}`)} />
        <Section title="Pest and disease" empty={none} lines={[
          ...data.scouting.map((s: any) => `${formatDate(s.date)} · ${s.disease || s.pest || s.health}${s.recommendation ? ` — ${s.recommendation}` : ''}`),
          ...data.protection.map((p: any) => `${formatDate(p.date)} · ${p.name} (${t(p.type)}${p.severity ? `, ${t(p.severity)}` : ''})`),
        ]} />
        <Section title="Recent work" empty={none} lines={data.activities.map((a: any) => `${formatDate(a.date)} · ${a.type}${a.description ? ` — ${a.description}` : ''}`)} />
        <Section title="Harvested" empty={none} lines={data.harvested_kg.map((h: any) => `${h.crop} · ${Number(h.kg).toLocaleString()} kg`)} />
      </View>
    </>
  );
}
export function OrgFarmerScreen({ route }: any) { return <Screen><OrgGate>{(p: any) => <FarmerBody {...p} route={route} />}</OrgGate></Screen>; }

/* ------------------------------------------------------------------ activity */
const ACTION_TEXT: Record<string, string> = {
  'farmers.invited': 'Farmers invited', 'farmer.joined': 'A farmer joined', 'farmer.left': 'A farmer left', 'farmer.removed': 'A farmer was removed', 'farmer.records_viewed': "A farmer's records were opened",
  'farmer_invite.resent': 'Invitation sent again', 'farmer_invite.revoked': 'Invitation cancelled', 'member.invited': 'Team member invited', 'member.removed': 'Team member removed', 'member.role_changed': 'Team role changed',
  'referral_link.created': 'Referral link created', 'referral_link.revoked': 'Referral link cancelled', 'organization.updated': 'Organization details changed', 'farmers.exported': 'Farmer list exported',
};

function ActivityBody({ org, role }: { org: any; role: string }) {
  const { colors } = useTheme();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrgActivity(org.id, page, role === 'org_admin');
  if (role !== 'org_admin') return <EmptyState icon="lock" title="Administrators only" description="Only an administrator can read the activity log." />;
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 25));
  return (
    <>
      <PageHeader title="Activity" subtitle="Who did what in your organization." />
      {isLoading ? <Loading /> : !data?.data?.length ? <EmptyState icon="clock-rotate-left" title="No activity yet" /> : (
        <View style={{ gap: 10 }}>
          {data.data.map((a: any) => (
            <Card key={a.id}>
              <AppText weight="700" style={{ fontSize: 13 }}>{t(ACTION_TEXT[a.action] || a.action)}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{`${a.actor || '—'} · ${formatDateTime(a.created_at)}`}</AppText>
            </Card>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button title="Previous" size="sm" kind="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
            <AppText style={{ fontSize: 12, color: colors.textLight }}>{page} / {pages}</AppText>
            <Button title="Next" size="sm" kind="secondary" disabled={page >= pages} onPress={() => setPage((p) => p + 1)} />
          </View>
        </View>
      )}
    </>
  );
}
export function OrgActivityScreen() { return <Screen><OrgGate>{(p: any) => <ActivityBody {...p} />}</OrgGate></Screen>; }
