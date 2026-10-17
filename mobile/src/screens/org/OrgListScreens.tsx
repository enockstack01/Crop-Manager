import React, { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, Badge, ChartCard, EmptyState, Loading, PageHeader, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/fields';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { formatDate, formatDateTime } from '../../lib/format';
import { reasonText, useOrgFarmers, useOrgLinks, useOrgMembers, useOrgMutations } from '../../lib/orgApi';
import { OrgGate, UsageMeter } from './OrgGate';
import { t } from '../../i18n';

/* ----------------------------------------------------------------- farmers */
function FarmersBody({ org, role, route }: { org: any; role: string; route: any }) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [inactive, setInactive] = useState<string>(route?.params?.inactive || '');
  const [page, setPage] = useState(1);
  const params: Record<string, any> = { page, perPage: 20, ...(q ? { q } : {}), ...(inactive ? { inactive } : {}) };
  const { data, isLoading, isError, refetch } = useOrgFarmers(org.id, params);
  const { removeFarmer } = useOrgMutations(org.id);

  const remove = async (f: any) => {
    const ok = await confirm(t('Remove {{name}} from {{org}}? They keep their account and data, and can rejoin with a new link.', { name: f.name, org: org.name }), { confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    try { await removeFarmer.mutateAsync(f.farmer_id); toast(t('Farmer removed')); } catch (err) { toast(reasonText(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Farmers" subtitle="Farmers linked to your organization." />
      <TextField label="Search" value={q} onChangeValue={(v) => { setQ(v); setPage(1); }} placeholder={t('Search name, location or crop...')} icon="magnifying-glass" />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Button title={inactive ? 'Showing: no recent activity' : 'No recent activity'} size="sm" kind={inactive ? 'primary' : 'secondary'} onPress={() => { setInactive(inactive ? '' : '1'); setPage(1); }} />
      </View>
      {isLoading ? <Loading /> : isError ? (
        <EmptyState icon="triangle-exclamation" title="Could not load farmers" actionLabel="Retry" onAction={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState icon="users" title="No farmers yet" description="Create a referral link and share it with your farmers. They appear here when they join." />
      ) : (
        <View style={{ gap: 10 }}>
          {data.data.map((f: any) => (
            <View key={f.farmer_id} style={{ padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <AppText weight="700" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{f.name}</AppText>
                {f.inactive ? <Badge label="No recent activity" tone="warning" /> : null}
              </View>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>
                {[f.location, f.farms ? `${Math.round(f.farm_ha * 10) / 10} ha` : '', f.crops.join(', ')].filter(Boolean).join(' · ') || '—'}
              </AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>
                {t('Joined')} {formatDate(f.joined_at)} · {t('Last activity')}: {f.last_activity ? formatDate(f.last_activity) : t('none')}
              </AppText>
              {role === 'org_admin' ? <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Button title="Remove" size="sm" kind="secondary" icon="user-minus" onPress={() => remove(f)} /></View> : null}
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Button title="Previous" size="sm" kind="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
            <AppText style={{ fontSize: 12, color: colors.textLight }}>{page} / {Math.max(1, Math.ceil(data.total / 20))}</AppText>
            <Button title="Next" size="sm" kind="secondary" disabled={page >= Math.ceil(data.total / 20)} onPress={() => setPage((p) => p + 1)} />
          </View>
        </View>
      )}
    </>
  );
}

export function OrgFarmersScreen({ route }: any) {
  return <Screen><OrgGate>{({ org, role }) => <FarmersBody org={org} role={role} route={route} />}</OrgGate></Screen>;
}

/* -------------------------------------------------------------------- links */
function Countdown({ to }: { to: string }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return <AppText weight="700" style={{ fontSize: 13, color: s === 0 ? colors.red : colors.primaryDark }}>{s === 0 ? t('Expired') : `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`}</AppText>;
}

const LINK_TONE: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = { active: 'success', expired: 'neutral', revoked: 'danger', full: 'warning', inactive: 'neutral' };

function LinksBody({ org, role }: { org: any; role: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: links, isLoading } = useOrgLinks(org.id);
  const { createLink, revokeLink } = useOrgMutations(org.id);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [fresh, setFresh] = useState<any>(null);

  const create = async () => {
    try { setFresh(await createLink.mutateAsync({ label, max_uses: maxUses })); setLabel(''); } catch (err) { toast(reasonText(err), 'error'); }
  };
  const revoke = async (l: any) => {
    if (!(await confirm(t('Cancel this link now? Nobody can join with it afterwards.'), { confirmLabel: 'Cancel link', danger: true }))) return;
    try { await revokeLink.mutateAsync(l.id); toast(t('Link cancelled')); } catch (err) { toast(reasonText(err), 'error'); }
  };
  const message = fresh ? `${t('Join our organization on CropManager')}: ${fresh.url}` : '';

  return (
    <>
      <PageHeader title="Referral links" subtitle="Share a link so farmers can join your organization. Each link works for six hours." />
      {fresh ? (
        <View style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: 16, gap: 12, marginBottom: 16, backgroundColor: colors.card }}>
          <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('New referral link')}</AppText>
          <AppText selectable style={{ fontSize: 12 }}>{fresh.url}</AppText>
          <View style={{ alignItems: 'center', padding: 8, backgroundColor: '#FFFFFF', borderRadius: radius.md, alignSelf: 'center' }}>
            <QRCode value={fresh.url} size={170} color="#14532D" backgroundColor="#FFFFFF" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button title="Share" icon="share-nodes" onPress={() => Share.share({ message })} />
            <Button title="Copy" icon="copy" kind="secondary" onPress={async () => { await Clipboard.setStringAsync(fresh.url); toast(t('Link copied')); }} />
            <Button title="Done" kind="ghost" onPress={() => setFresh(null)} />
          </View>
          <AppText style={{ fontSize: 12, color: colors.textLight }}>
            {t('Valid for')} <Countdown to={fresh.expires_at} /> · {t('Up to {{count}} farmers can join with it.', { count: fresh.max_uses })} {t('This is the only time the full link is shown.')}
          </AppText>
        </View>
      ) : null}

      <ChartCard title="Generate referral link" icon="link">
        <View style={{ gap: 4 }}>
          <TextField label="Label (optional)" value={label} onChangeValue={setLabel} placeholder={t('For example: Huye field day')} />
          <TextField label="Maximum farmers" value={maxUses} onChangeValue={setMaxUses} keyboardType="number-pad" placeholder={t('Default')} />
          <View style={{ alignSelf: 'flex-start' }}>
            <Button title="Generate referral link" icon="link" loading={createLink.isPending} disabled={org.status !== 'active'} onPress={create} />
          </View>
        </View>
      </ChartCard>

      <View style={{ height: 16 }} />
      {isLoading ? <Loading /> : !links?.length ? (
        <EmptyState icon="link" title="No referral links yet" description="Generate a link, then share it by WhatsApp, SMS or QR code." />
      ) : (
        <View style={{ gap: 10 }}>
          {links.map((l: any) => (
            <View key={l.id} style={{ padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <AppText weight="700" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{l.label || t('Referral link')}</AppText>
                <Badge label={l.status} tone={LINK_TONE[l.status] || 'neutral'} />
              </View>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Created by')} {l.created_by || '—'} · {formatDateTime(l.created_at)}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Expires')} {formatDateTime(l.expires_at)} · {t('Farmers joined')}: {l.use_count}{l.max_uses ? ` / ${l.max_uses}` : ''}</AppText>
              {l.status === 'active' ? <Countdown to={l.expires_at} /> : null}
              {role === 'org_admin' && l.status === 'active' ? <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Button title="Cancel link" size="sm" kind="secondary" icon="ban" onPress={() => revoke(l)} /></View> : null}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

export function OrgLinksScreen() {
  return <Screen><OrgGate>{({ org, role }) => <LinksBody org={org} role={role} />}</OrgGate></Screen>;
}

/* --------------------------------------------------------------------- team */
const ROLES = [{ value: 'org_staff', label: 'Field officer' }, { value: 'org_admin', label: 'Administrator' }];

function TeamBody({ org }: { org: any }) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: members, isLoading } = useOrgMembers(org.id);
  const { invite, removeMember } = useOrgMutations(org.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('org_staff');

  const send = async () => {
    try { await invite.mutateAsync({ email, role }); toast(t('Invitation saved. They join when they sign in with {{email}}.', { email })); setEmail(''); } catch (err) { toast(reasonText(err), 'error'); }
  };
  const remove = async (m: any) => {
    if (!(await confirm(t('Remove {{name}} from the team?', { name: m.name || m.email }), { confirmLabel: 'Remove', danger: true }))) return;
    try { await removeMember.mutateAsync(m.id); toast(t('Team member removed')); } catch (err) { toast(reasonText(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Team" subtitle="Administrators manage the organization. Field officers create referral links and view farmers." />
      <ChartCard title="Invite" icon="user-plus">
        <TextField label="Email address" value={email} onChangeValue={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
        <SelectField label="Role" value={role} onChangeValue={setRole} options={ROLES.map((r) => ({ value: r.value, label: t(r.label) }))} placeholder="" />
        <View style={{ alignSelf: 'flex-start' }}><Button title="Invite" icon="user-plus" loading={invite.isPending} disabled={!email.includes('@')} onPress={send} /></View>
      </ChartCard>
      <View style={{ height: 16 }} />
      {isLoading ? <Loading /> : (
        <View style={{ gap: 10 }}>
          {(members || []).map((m: any) => (
            <View key={m.id} style={{ padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, gap: 4 }}>
              <AppText weight="700" style={{ fontSize: 14 }}>{m.name || m.email}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{m.name ? `${m.email} · ` : ''}{t(ROLES.find((r) => r.value === m.role)?.label || m.role)} · {t(m.status === 'invited' ? 'Invited' : 'Active')}</AppText>
              <View style={{ alignSelf: 'flex-start', marginTop: 4 }}><Button title="Remove" size="sm" kind="secondary" icon="user-minus" onPress={() => remove(m)} /></View>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

export function OrgTeamScreen() {
  return <Screen><OrgGate adminOnly>{({ org }) => <TeamBody org={org} />}</OrgGate></Screen>;
}

/* ------------------------------------------------------------------ profile */
const TYPES = ['Cooperative', 'NGO', 'Company', 'Government', 'Other'];

function ProfileBody({ org }: { org: any }) {
  const toast = useToast();
  const { update } = useOrgMutations(org.id);
  const [v, setV] = useState({ name: org.name, type: org.type, country: org.country || '', district: org.district || '', sector: org.sector || '', contact_email: org.contact_email || '', contact_phone: org.contact_phone || '' });
  const set = (k: string) => (val: string) => setV((x) => ({ ...x, [k]: val }));
  const save = async () => {
    try { await update.mutateAsync(v); toast(t('Organization updated')); } catch (err) { toast(reasonText(err), 'error'); }
  };
  return (
    <>
      <PageHeader title="Organization" subtitle="Your organization profile and farmer limit." />
      <ChartCard title="Status and limit" icon="gauge">
        <View style={{ gap: 10 }}>
          <View style={{ alignSelf: 'flex-start' }}><Badge label={org.status} tone={org.status === 'active' ? 'success' : org.status === 'pending' ? 'warning' : 'danger'} /></View>
          <UsageMeter count={org.farmer_count} max={org.max_farmers} />
          <AppText variant="subtitle" style={{ fontSize: 12 }}>{t('Only a CropManager administrator can change the farmer limit. Contact support to raise it.')}</AppText>
        </View>
      </ChartCard>
      <View style={{ height: 16 }} />
      <ChartCard title="Profile" icon="building">
        <TextField label="Organization name" required value={v.name} onChangeValue={set('name')} />
        <SelectField label="Type" value={v.type} onChangeValue={set('type')} options={TYPES.map((x) => ({ value: x, label: t(x) }))} placeholder="" />
        <TextField label="Country" value={v.country} onChangeValue={set('country')} />
        <TextField label="District" value={v.district} onChangeValue={set('district')} />
        <TextField label="Sector" value={v.sector} onChangeValue={set('sector')} />
        <TextField label="Contact email" value={v.contact_email} onChangeValue={set('contact_email')} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Contact phone" value={v.contact_phone} onChangeValue={set('contact_phone')} keyboardType="phone-pad" />
        <View style={{ alignSelf: 'flex-start' }}><Button title="Save changes" icon="content-save" loading={update.isPending} onPress={save} /></View>
      </ChartCard>
    </>
  );
}

export function OrgProfileScreen() {
  return <Screen><OrgGate>{({ org }) => <ProfileBody org={org} />}</OrgGate></Screen>;
}
