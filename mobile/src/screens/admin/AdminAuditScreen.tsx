import React, { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useAdminAudit } from '../../lib/adminApi';
import { formatDateTime } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Card, EmptyState, Loading, PageHeader, Screen } from '../../components/ui';
import { DateField } from '../../components/fields';
import { Chips, Pager, SearchBox } from './bits';
import { t } from '../../i18n';

const ACTIONS = [
  'organization.registered', 'organization.created', 'organization.approved', 'organization.suspended', 'organization.reactivated',
  'organization.limit_changed', 'organization.updated', 'organization.deleted', 'referral_link.created', 'referral_link.revoked',
  'farmer.joined', 'farmer.left', 'farmer.removed', 'farmers.imported', 'farmers.exported', 'member.invited', 'member.removed', 'settings.updated', 'user.deleted',
];
const PER = 25;

/** web Audit log: who did what, filterable by action, person and dates. */
export function AdminAuditScreen() {
  const { colors } = useTheme();
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const id = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);
  const params: Record<string, any> = { page, perPage: PER };
  if (action) params.action = action;
  if (dq) params.q = dq;
  if (from) params.from = from;
  if (to) params.to = to;
  const { data, isLoading, isError, refetch, isFetching } = useAdminAudit(params);

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Audit log" subtitle="Who did what: approvals, limits, links, farmers and team changes." />
      <SearchBox value={q} onChange={setQ} placeholder="Search person or id..." />
      <Chips value={action} onChange={(v) => { setAction(v); setPage(1); }} options={[{ id: '', label: 'All actions' }, ...ACTIONS.map((a) => ({ id: a, label: a }))]} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <View style={{ flex: 1 }}><DateField value={from} onChangeValue={(v) => { setFrom(v); setPage(1); }} label="From" /></View>
        <View style={{ flex: 1 }}><DateField value={to} onChangeValue={(v) => { setTo(v); setPage(1); }} label="To" /></View>
      </View>
      {isLoading ? <Loading /> : isError ? <EmptyState icon="triangle-exclamation" title="Could not load the audit log" /> : !data?.data?.length ? (
        <EmptyState icon="clipboard-list" title="Nothing recorded" description="Actions on organizations appear here." />
      ) : (
        <View style={{ gap: 10 }}>
          {data.data.map((a: any) => (
            <Card key={a.id} style={{ padding: 14, gap: 3 }}>
              <AppText weight="700" style={{ fontSize: 13 }}>{a.action}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{formatDateTime(a.created_at)} · {a.actor || '—'}{a.organization ? ` · ${a.organization}` : ''}</AppText>
              {a.details && Object.keys(a.details).length ? <AppText style={{ fontSize: 11, color: colors.textLight }}>{JSON.stringify(a.details)}</AppText> : null}
            </Card>
          ))}
        </View>
      )}
      <Pager page={data?.page || page} totalPages={Math.max(1, Math.ceil((data?.total || 0) / PER))} onChange={setPage} />
    </Screen>
  );
}
