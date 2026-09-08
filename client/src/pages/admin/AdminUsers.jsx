import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminUsers, useAdminUserMutations } from '../../lib/useAdmin.js';
import { useProfile } from '../../components/profile.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { PageHeader, DataTable, Pagination, TableToolbar, FilterSelect, EmptyState, IconButton } from '../../components/ui.jsx';
import { debounce, formatDate, formatNumber } from '../../lib/format.js';

export default function AdminUsers() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile: me } = useProfile();
  const { update, remove } = useAdminUserMutations();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const params = { page, perPage: 20 };
  if (q) params.q = q;
  if (status) params.status = status;
  const { data, isLoading, isError } = useAdminUsers(params);
  const rows = data?.data || [];

  const onSearch = debounce((v) => { setQ(v.trim()); setPage(1); }, 300);

  const toggle = async (row, field) => {
    try {
      await update.mutateAsync({ userId: row.user_id, [field]: !row[field] });
      toast('User updated');
    } catch (e) {
      toast(e.message || 'Failed', 'error');
    }
  };

  const del = async (row) => {
    const ok = await confirm(
      `Permanently delete <strong>${row.full_name || row.email || row.user_id}</strong>?<br>This removes their Clerk account and <strong>all</strong> their farm data. This cannot be undone.`
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
      <PageHeader title="User Management" subtitle="All platform users and their data." />

      <TableToolbar onSearch={onSearch} searchPlaceholder="Search name or email...">
        <FilterSelect
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          placeholder="All users"
          options={[
            { value: 'active', label: 'Active only' },
            { value: 'inactive', label: 'Deactivated' },
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
                  <strong>{r.full_name || '—'}</strong>
                  {r.is_admin && <span className="badge badge-primary" style={{ marginLeft: 8 }}>Admin</span>}
                  {r.is_active === false && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Inactive</span>}
                  <br />
                  <span className="text-xs text-light">{r.email || r.user_id}</span>
                </>
              ),
            },
            { key: 'role', label: 'Role', render: (r) => <span className="badge badge-neutral">{r.role || '—'}</span> },
            { key: 'farms', label: 'Farms', render: (r) => formatNumber(r.farms) },
            { key: 'cycles', label: 'Cycles', render: (r) => formatNumber(r.cycles) },
            { key: 'harvests', label: 'Harvests', render: (r) => formatNumber(r.harvests) },
            { key: 'last_seen_at', label: 'Last seen', render: (r) => (r.last_seen_at ? formatDate(r.last_seen_at) : '—') },
            { key: 'created_at', label: 'Joined', render: (r) => formatDate(r.created_at) },
          ]}
          rows={rows}
          loading={isLoading}
          actions={(row) => (
            <>
              <IconButton icon="fa-eye" title="View" onClick={() => navigate(`/admin/users/${row.user_id}`)} />
              <IconButton
                icon={row.is_active === false ? 'fa-user-check' : 'fa-user-slash'}
                title={row.is_active === false ? 'Activate' : 'Deactivate'}
                color={row.is_active === false ? 'var(--green)' : 'var(--orange)'}
                onClick={() => toggle(row, 'is_active')}
              />
              <IconButton
                icon="fa-user-shield"
                title={row.is_admin ? 'Revoke admin' : 'Make admin'}
                color={row.is_admin ? 'var(--purple)' : undefined}
                onClick={() => toggle(row, 'is_admin')}
              />
              {row.user_id !== me?.user_id && (
                <IconButton icon="fa-trash" title="Delete user" danger onClick={() => del(row)} />
              )}
            </>
          )}
          empty={<EmptyState icon="fa-users" title="No users found" />}
        />
      )}

      <Pagination page={page} totalPages={data?.totalPages || 1} onChange={setPage} />
    </>
  );
}
