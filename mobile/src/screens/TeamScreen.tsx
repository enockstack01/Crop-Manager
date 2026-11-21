import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Badge, EmptyState, Grid, Loading, PageHeader, Screen, StatTile } from '../components/ui';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { TextField, useForm } from '../components/fields';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { formatDate, formatNumber } from '../lib/format';
import { useMember, useTeam, useTeamMutations } from '../lib/team';
import { agoParts, inviteProblem, MEMBER_STATUS } from '../lib/teamRules';
import { t } from '../i18n';

/*
 * The Team screen: the farm manager's data collectors. Add one (name, email, optional phone: they get an email to set a password), follow each
 * one's entries this week and last activity, cancel a waiting invitation or remove a collector. Removing someone ends their access; the entries
 * they already made stay in the farm's records.
 */
const when = (iso?: string | null) => {
  const a = agoParts(iso);
  return a ? t(a.key, { n: a.n, date: a.date ? formatDate(a.date) : '' }) : t('Never');
};

function AddSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { invite } = useTeamMutations();
  const form = useForm({ name: '', email: '', phone: '' });
  const [err, setErr] = useState('');
  const send = async () => {
    const p = inviteProblem(form.values);
    if (p) { setErr(t(p)); return; }
    setErr('');
    try {
      const m = await invite.mutateAsync(form.values);
      toast(m.status === 'active' ? t('{{name}} was added to your team.', { name: m.name }) : m.email_sent ? t('Invitation sent to {{email}}.', { email: m.email }) : m.email_test_mode ? t('Invitation saved (no email is sent in test mode).') : t('Invitation saved, but the email could not be sent: {{why}}. Send it again later.', { why: m.email_error || t('unknown error') }), m.email_error ? 'info' : 'success');
      onClose();
    } catch (e: any) { setErr(e?.message || t('Could not send the invitation.')); }
  };
  return (
    <Sheet visible onClose={onClose} title={t('Add data collector')} footer={<Button title="Send invitation" icon="paper-plane" loading={invite.isPending} onPress={send} />}>
      <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight, marginBottom: 10 }}>{t('The collector gets an email invitation to set a password. When they sign in, the invitation becomes their account and links them to your farm. An administrator approves the account like every account on the platform.')}</AppText>
      {err ? <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}><AppText style={{ fontSize: 13, color: colors.red }}>{err}</AppText></View> : null}
      <TextField label="Name" required {...form.bind('name')} placeholder="e.g. Alice Uwase" />
      <TextField label="Email address" required {...form.bind('email')} placeholder="alice@example.com" autoCapitalize="none" />
      <TextField label="Phone number (optional)" {...form.bind('phone')} placeholder="+250 788 000 000" />
    </Sheet>
  );
}

function DetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { colors } = useTheme();
  const { data, isLoading } = useMember(id);
  return (
    <Sheet visible onClose={onClose} title={data?.name || t('Data collector')}>
      {isLoading || !data ? <Loading /> : (
        <View style={{ gap: 12 }}>
          <AppText style={{ fontSize: 13, color: colors.textLight }}>{data.email}{data.phone ? ` · ${data.phone}` : ''}</AppText>
          <Grid columns={2} gap={10}>
            <StatTile label="Entries this week" value={formatNumber(data.week_entries)} />
            <StatTile label="Last activity" value={when(data.last_activity)} />
          </Grid>
          <AppText weight="700" style={{ fontSize: 14 }}>{t('Latest entries')}</AppText>
          {data.recent.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Nothing recorded yet.')}</AppText> : data.recent.map((r: any) => (
            <View key={`${r.path}${r.id}`} style={{ gap: 2 }}>
              <AppText weight="700" style={{ fontSize: 14 }}>{t(r.kind)}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{r.hint ? `${r.hint} · ` : ''}{r.date ? formatDate(r.date) : formatDate(String(r.created_at).slice(0, 10))} · {when(r.created_at)}</AppText>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

export function TeamScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useTeam();
  const { resend, remove } = useTeamMutations();
  if (isLoading) return <Screen><Loading /></Screen>;
  if (isError || !data) return <Screen><EmptyState icon="triangle-exclamation" title="Could not load your team" actionLabel="Retry" onAction={() => refetch()} /></Screen>;

  const onResend = async (m: any) => {
    try {
      const r = await resend.mutateAsync(m.id);
      toast(r.email_sent ? t('Invitation sent again to {{email}}.', { email: m.email }) : r.email_test_mode ? t('Saved (no email is sent in test mode).') : t('The email could not be sent: {{why}}', { why: r.email_error || t('unknown error') }), r.email_sent || r.email_test_mode ? 'success' : 'error');
    } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  const onRemove = async (m: any) => {
    const waiting = m.status === 'invited' || m.status === 'expired';
    const ok = await confirm(waiting ? t('Cancel the invitation to {{name}}?', { name: m.name || m.email }) : t('Remove {{name}} from your team? Their access ends at once. The entries they recorded stay in your records.', { name: m.name || m.email }), { confirmLabel: waiting ? 'Cancel invitation' : 'Remove' });
    if (!ok) return;
    try { await remove.mutateAsync(m.id); toast(waiting ? t('Invitation cancelled') : t('Removed from your team')); } catch (e: any) { toast(e?.message || '', 'error'); }
  };

  return (
    <Screen>
      <PageHeader title="Team" subtitle="Your data collectors: invite them, follow what they record, and end their access whenever you need to." />
      <Button title="Add data collector" icon="user-plus" onPress={() => setAdding(true)} />
      <View style={{ height: 14 }} />
      <Grid columns={3} gap={10}>
        <StatTile label="Collectors" value={String(data.totals.collectors)} />
        <StatTile label="Waiting" value={String(data.totals.waiting)} />
        <StatTile label="This week" value={formatNumber(data.totals.entries_this_week)} sub={t('entries')} />
      </Grid>
      <View style={{ height: 14 }} />
      {data.data.length === 0 ? <EmptyState icon="user-group" title="No data collectors yet" description="Add a data collector to get help in the field. Everything they record goes into your farm, tagged with their name." actionLabel="Add data collector" onAction={() => setAdding(true)} /> : (
        <View style={{ gap: 12 }}>
          {data.data.map((m: any) => {
            const st = MEMBER_STATUS[m.status] || MEMBER_STATUS.active;
            return (
              <View key={m.id} style={{ gap: 6, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <AppText weight="700" style={{ fontSize: 16, flex: 1 }}>{m.name || m.email}</AppText>
                  <Badge label={t(st.label)} tone={st.tone} />
                </View>
                <AppText style={{ fontSize: 12, color: colors.textLight }}>{m.email}{m.phone ? ` · ${m.phone}` : ''}</AppText>
                {m.role === 'manager' ? <View style={{ alignSelf: 'flex-start' }}><Badge label={t('Greenhouse manager')} tone="info" /></View> : null}
                {m.status === 'active' ? <AppText style={{ fontSize: 13 }}>{formatNumber(m.week_entries)} {t('entries this week')} · {t('last activity')}: {when(m.last_activity)}</AppText> : <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Invited')} {when(m.invited_at)}{!m.email_sent && m.email_error ? ` · ${t('Email not sent')}` : ''}</AppText>}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {m.status === 'active' ? <Button title="Entries" icon="eye" size="sm" kind="secondary" onPress={() => setOpen(m.id)} /> : null}
                  {m.status === 'invited' || m.status === 'expired' ? <Button title="Send again" icon="rotate" size="sm" kind="secondary" loading={resend.isPending} onPress={() => onResend(m)} /> : null}
                  <Button title={m.status === 'active' ? 'Remove' : 'Cancel invitation'} size="sm" kind="secondary" onPress={() => onRemove(m)} />
                </View>
              </View>
            );
          })}
        </View>
      )}
      {adding ? <AddSheet onClose={() => setAdding(false)} /> : null}
      {open ? <DetailSheet id={open} onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}
