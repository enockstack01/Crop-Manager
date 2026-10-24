import React, { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useAdminMutations, useAdminUsers, actionsFor, ACCOUNT_ACTIONS } from '../../lib/adminApi';
import { useProfile } from '../../lib/useResource';
import { displayName, formatDate, formatNumber } from '../../lib/format';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Badge, Card, EmptyState, Loading, PageHeader, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { Chips, ListRow, Pager, SearchBox, StatusPill, plain, useAccountActions } from './bits';
import { t } from '../../i18n';

const FILTERS = [
  { id: '', label: 'All users' },
  { id: 'pending', label: 'Pending approval' },
  { id: 'active', label: 'Active' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'deactivated', label: 'Deactivated' },
  { id: 'new', label: 'No request yet' },
  { id: 'admins', label: 'Administrators' },
];

/** web User Management: search, filter by account status, open a user, approve / hold / deactivate / admin / delete. */
export function AdminUsersScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile: me } = useProfile();
  const { updateUser, removeUser } = useAdminMutations();
  const { start, dialog } = useAccountActions();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<string>(route?.params?.status || '');

  useEffect(() => { const id = setTimeout(() => { setDebounced(q.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);
  useEffect(() => { if (route?.params?.status !== undefined) setStatus(route.params.status); }, [route?.params?.status]);

  const params: Record<string, any> = { page, perPage: 20 };
  if (debounced) params.q = debounced;
  if (status) params.status = status;
  const { data, isLoading, isError, refetch, isFetching } = useAdminUsers(params);
  const rows: any[] = data?.data || [];

  const toggleAdmin = async (row: any) => {
    try { await updateUser.mutateAsync({ userId: row.user_id, is_admin: !row.is_admin }); toast(row.is_admin ? 'Admin revoked' : 'Admin granted'); } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };
  const del = async (row: any) => {
    if (!(await confirm(plain(t('Permanently delete {{name}}? This removes their account and all their farm data. This cannot be undone.', { name: row.full_name || row.email || row.user_id }))))) return;
    try { const res = await removeUser.mutateAsync(row.user_id); toast(t('Deleted user and {{n}} records', { n: res.documents_removed })); } catch (e: any) { toast(e?.message || 'Failed to delete', 'error'); }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="User Management" subtitle="Account requests, access and data for every user." />
      <SearchBox value={q} onChange={setQ} placeholder="Search name or email..." />
      <Chips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={FILTERS} />

      {isLoading ? <Loading /> : isError ? <EmptyState icon="triangle-exclamation" title="Could not load users" /> : rows.length === 0 ? (
        <EmptyState icon="users" title="No users found" />
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((row) => {
            const self = row.user_id === me?.user_id;
            return (
              <Card key={row.id} style={{ padding: 0 }}>
                <ListRow
                  title={displayName(row)}
                  lines={[`${row.public_id ? `${row.public_id} · ` : ''}${row.email || row.user_id}`, `${row.role || '—'}${row.access_request?.organization ? ` · ${row.access_request.organization}` : ''}`, `${formatNumber(row.farms)} ${t('Farms')} · ${formatNumber(row.cycles)} ${t('Cycles')} · ${t('Joined')} ${formatDate(row.created_at)}`]}
                  right={<View style={{ gap: 4, alignItems: 'flex-end' }}>{row.is_admin ? <Badge label="Admin" tone="primary" /> : null}<StatusPill status={row.account_status} /></View>}
                  onPress={() => navigation.navigate('admin-user', { userId: row.user_id })}
                  last
                />
                {!self ? (
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12 }}>
                    {!row.is_admin ? actionsFor(row.account_status).map((key) => (
                      <Button key={key} title={ACCOUNT_ACTIONS[key].label} icon={ACCOUNT_ACTIONS[key].icon} size="sm" kind={ACCOUNT_ACTIONS[key].kind === 'danger' ? 'secondary' : ACCOUNT_ACTIONS[key].kind} onPress={() => start(row, key)} />
                    )) : null}
                    <Button title={row.is_admin ? 'Revoke admin' : 'Make admin'} icon="user-shield" size="sm" kind="secondary" onPress={() => toggleAdmin(row)} />
                    <Button title="Delete user" icon="trash" size="sm" kind="danger" onPress={() => del(row)} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
      <Pager page={page} totalPages={data?.totalPages || 1} onChange={setPage} />
      {dialog}
    </Screen>
  );
}
