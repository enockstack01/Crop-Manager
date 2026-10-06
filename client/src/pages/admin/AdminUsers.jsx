import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminUsers, useAdminUserMutations } from '../../lib/useAdmin.js';
import { useProfile } from '../../components/profile.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { PageHeader, DataTable, Pagination, TableToolbar, FilterSelect, EmptyState, IconButton } from '../../components/ui.jsx';
import { debounce, displayName, formatDate, formatNumber } from '../../lib/format.js';
import { ACTIONS, STATUS_META, StatusPill, actionsFor, useAccountActions } from './accountActions.jsx';
import { t } from '../../i18n/index.js';

export default function AdminUsers() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile: me } = useProfile();
  const { update, remove } = useAdminUserMutations();
  const { start, dialog } = useAccountActions();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');

  const params = { page, perPage: 20 };
  if (q) params.q = q;
  if (status) params.status = status;
  const { data, isLoading, isError } = useAdminUsers(params);
  const rows = data?.data || [];

  const onSearch = debounce((v) => { setQ(v.trim()); setPage(1); }, 300);

  const toggleAdmin = async (row) => {
    try {
      await update.mutateAsync({ userId: row.user_id, is_admin: !row.is_admin });
      toast(row.is_admin ? 'Admin revoked' : 'Admin granted');
    } catch (e) {
      toast(e.message || 'Failed', 'error');
    }
  };

  const del = async (row) => {
    const ok = await confirm(
      `Permanently delete <strong>${row.full_name || row.email || row.user_id}</strong>?<br>{t('This removes their Clerk account and')} <strong>{t('all')}</strong> their farm data. This cannot be undone.`
    );
    if (!ok) return;
    try {
      const res = await remove.mutateAsync(row.user_id);
      toast(`Deleted user and ${res.documents_removed} records`);
    } catch (e) {
      toast(e.message || 'Failed to delete', 'error');
    }
  };

  return (
    <>
      <PageHeader title="User Management" subtitle="Account requests, access and data for every user." />

      <TableToolbar onSearch={onSearch} searchPlaceholder="Search name or email...">
        <FilterSelect
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          placeholder="All users"
          options={[
            ...['pending', 'active', 'on_hold', 'rejected', 'deactivated', 'new'].map((s) => ({ value: s, label: STATUS_META[s].label })),
            { value: 'admins', label: 'Administrators' },
          ]}
        />
      </TableToolbar>

      {isError ? (
        <EmptyState icon="fa-exclamation-triangle" title="Could not load users" />
      ) : (
        <DataTable
          columns={[
            {
              key: 'full_name',
              label: 'User',
              render: (r) => (
                <>
                  <strong>{displayName(r)}</strong>
                  {r.is_admin && <span className="badge badge-primary" style={{ marginLeft: 8 }}>{t('Admin')}</span>}
                  <br />
                  <span className="text-xs text-light">{r.email || r.user_id}</span>
                </>
              ),
            },
            { key: 'account_status', label: 'Status', render: (r) => <StatusPill status={r.account_status} /> },
            {
              key: 'role',
              label: 'Account type',
              render: (r) => (
                <>
                  <span className="badge badge-neutral">{r.role || '—'}</span>
                  {r.account_status === 'pending' && r.access_request?.account_type && r.access_request.account_type !== r.role && (
                    <div className="text-xs text-light" style={{ marginTop: 4 }}>Requested: {r.access_request.account_type}</div>
                  )}
                </>
              ),
            },
            {
              key: 'organization',
              label: 'Farm / organisation',
              render: (r) => r.access_request?.organization
                ? <>{r.access_request.organization}<br /><span className="text-xs text-light">{r.access_request.country}</span></>
                : '—',
            },
            { key: 'farms', label: 'Farms', render: (r) => formatNumber(r.farms) },
            { key: 'cycles', label: 'Cycles', render: (r) => formatNumber(r.cycles) },
            { key: 'last_seen_at', label: 'Last seen', render: (r) => (r.last_seen_at ? formatDate(r.last_seen_at) : '—') },
            { key: 'created_at', label: 'Joined', render: (r) => formatDate(r.created_at) },
          ]}
          rows={rows}
          loading={isLoading}
          actions={(row) => {
            const self = row.user_id === me?.user_id;
            return (
              <>
                <IconButton icon="fa-eye" title="View" onClick={() => navigate(`/admin/users/${row.user_id}`)} />
                {!self && !row.is_admin && actionsFor(row.account_status).map((key) => (
                  <IconButton
                    key={key}
                    icon={ACTIONS[key].icon}
                    title={ACTIONS[key].label}
                    color={ACTIONS[key].color}
                    onClick={() => start(row, key)}
                  />
                ))}
                {!self && (
                  <IconButton
                    icon="fa-user-shield"
                    title={row.is_admin ? 'Revoke admin' : 'Make admin'}
                    color={row.is_admin ? 'var(--purple)' : undefined}
                    onClick={() => toggleAdmin(row)}
                  />
                )}
                {!self && <IconButton icon="fa-trash" title="Delete user" danger onClick={() => del(row)} />}
              </>
            );
          }}
          empty={<EmptyState icon="fa-users" title="No users found" />}
        />
      )}

      <Pagination page={page} totalPages={data?.totalPages || 1} onChange={setPage} />
      {dialog}
    </>
  );
}
