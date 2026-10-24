import React, { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useAdminData, useAdminMutations, useAdminResources, useAdminUsers } from '../../lib/adminApi';
import { formatDate } from '../../lib/format';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Card, EmptyState, Loading, PageHeader, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { SelectField } from '../../components/fields';
import { Pager, SearchBox, plain } from './bits';
import { t } from '../../i18n';

const PREFERRED = ['name', 'buyer', 'fertilizer_name', 'problem_name', 'activity_type', 'scout_name', 'category'];

const titleOf = (r: any) => String(PREFERRED.map((k) => r[k]).find((v) => v) ?? r.id);
const summary = (r: any) => Object.entries(r)
  .filter(([k, v]) => !['id', 'user_id', '__v', 'owner', ...PREFERRED].includes(k) && v !== null && v !== '' && typeof v !== 'object')
  .slice(0, 5)
  .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${/_date$|_at$/.test(k) ? formatDate(String(v)) : String(v)}`)
  .join(' · ');

/** web Data Browser: view and manage every record across all users. */
export function AdminDataScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: resources } = useAdminResources();
  const { data: usersData } = useAdminUsers({ perPage: 100 });
  const { deleteRecord } = useAdminMutations();
  const [resource, setResource] = useState('farms');
  const [userId, setUserId] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<any>(null);
  useEffect(() => { const id = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);

  const params: Record<string, any> = { page, perPage: 20 };
  if (userId) params.userId = userId;
  if (dq) params.q = dq;
  const { data, isLoading, isError, refetch, isFetching } = useAdminData(resource, params);
  const rows: any[] = data?.data || [];

  const del = async (row: any) => {
    if (!(await confirm(plain(t('Delete this record ({{label}})?', { label: titleOf(row) }))))) return;
    try { await deleteRecord.mutateAsync({ resource, id: row.id }); toast('Record deleted'); setView(null); } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Data Browser" subtitle="View and manage every record across all users." />
      <SearchBox value={q} onChange={setQ} placeholder="Search records..." />
      <View style={{ gap: 10, marginBottom: 14 }}>
        <SelectField value={resource} onChangeValue={(v) => { setResource(v); setPage(1); }} placeholder="Select collection" options={(resources || []).map((r: any) => ({ value: r.path, label: r.name }))} />
        <SelectField value={userId} onChangeValue={(v) => { setUserId(v); setPage(1); }} placeholder="All users" options={(usersData?.data || []).map((u: any) => ({ value: u.user_id, label: u.full_name || u.email || u.user_id }))} />
      </View>
      {isLoading ? <Loading /> : isError ? <EmptyState icon="triangle-exclamation" title="Could not load data" /> : rows.length === 0 ? (
        <EmptyState icon="database" title="No records" />
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((row) => (
            <Card key={row.id} style={{ padding: 14, gap: 4 }}>
              <AppText weight="700" style={{ fontSize: 13 }}>{titleOf(row)}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{summary(row)}</AppText>
              <AppText style={{ fontSize: 11, color: colors.textLight }}>{row.owner?.full_name || row.owner?.email || '—'} · {formatDate(row.created_at)}</AppText>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Button title="Inspect" icon="eye" size="sm" kind="secondary" onPress={() => setView(row)} />
                <Button title="Delete record" icon="trash" size="sm" kind="danger" onPress={() => del(row)} />
              </View>
            </Card>
          ))}
        </View>
      )}
      <Pager page={page} totalPages={data?.totalPages || 1} onChange={setPage} />
      <Sheet visible={!!view} onClose={() => setView(null)} title="Record">
        <AppText style={{ fontSize: 11, lineHeight: 16 }}>{view ? JSON.stringify(view, null, 2) : ''}</AppText>
      </Sheet>
    </Screen>
  );
}
