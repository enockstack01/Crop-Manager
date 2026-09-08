import { useState } from 'react';
import { useAdminResources, useAdminData, useAdminUsers } from '../../lib/useAdmin.js';
import { PageHeader, DataTable, Pagination, TableToolbar, FilterSelect, EmptyState } from '../../components/ui.jsx';
import { debounce, formatDate } from '../../lib/format.js';

const PREFERRED = ['name', 'buyer', 'fertilizer_name', 'problem_name', 'activity_type', 'scout_name', 'category'];

function pickColumns(rows) {
  if (!rows.length) return [];
  const sample = rows[0];
  const keys = Object.keys(sample).filter(
    (k) => !['id', 'user_id', '__v', 'owner'].includes(k) && typeof sample[k] !== 'object'
  );
  keys.sort((a, b) => (PREFERRED.indexOf(b) - PREFERRED.indexOf(a)) || 0);
  return keys.slice(0, 6).map((k) => ({
    key: k,
    label: k.replace(/_/g, ' '),
    render: (r) => {
      const v = r[k];
      if (v == null || v === '') return '—';
      if (/_date$|_at$/.test(k)) return formatDate(v);
      return String(v);
    },
  }));
}

export default function AdminData() {
  const { data: resources } = useAdminResources();
  const { data: usersData } = useAdminUsers({ perPage: 100 });

  const [resource, setResource] = useState('farms');
  const [userId, setUserId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const params = { page, perPage: 20 };
  if (userId) params.userId = userId;
  if (q) params.q = q;
  const { data, isLoading, isError } = useAdminData(resource, params);
  const rows = data?.data || [];

  const onSearch = debounce((v) => { setQ(v.trim()); setPage(1); }, 300);

  const columns = [
    ...pickColumns(rows),
    { key: 'owner', label: 'Owner', render: (r) => r.owner?.full_name || r.owner?.email || '—' },
    { key: 'created_at', label: 'Created', render: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHeader title="Data Browser" subtitle="Read-only view of every record across all users." />

      <TableToolbar onSearch={onSearch} searchPlaceholder="Search records...">
        <FilterSelect
          value={resource}
          onChange={(v) => { setResource(v); setPage(1); }}
          placeholder="Select collection"
          options={(resources || []).map((r) => ({ value: r.path, label: r.name }))}
        />
        <FilterSelect
          value={userId}
          onChange={(v) => { setUserId(v); setPage(1); }}
          placeholder="All users"
          options={(usersData?.data || []).map((u) => ({ value: u.user_id, label: u.full_name || u.email || u.user_id }))}
        />
      </TableToolbar>

      {isError ? (
        <EmptyState icon="fa-exclamation-triangle" title="Could not load data" />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          empty={<EmptyState icon="fa-database" title="No records" />}
        />
      )}

      <Pagination page={page} totalPages={data?.totalPages || 1} onChange={setPage} />
    </>
  );
}
