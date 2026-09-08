import { useState } from 'react';
import { useAdminSettings, useAdminSettingsMutations } from '../../lib/useAdmin.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { PageHeader, Loading, EmptyState, ViewGrid, IconButton } from '../../components/ui.jsx';
import { formatNumber } from '../../lib/format.js';

function fmtUptime(s) {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminSettings() {
  const { data, isLoading, isError } = useAdminSettings();
  const { addAdmin, removeAdmin } = useAdminSettingsMutations();
  const toast = useToast();
  const confirm = useConfirm();
  const [email, setEmail] = useState('');

  if (isLoading) return <Loading label="Loading system settings..." />;
  if (isError || !data) return <EmptyState icon="fa-exclamation-triangle" title="Could not load settings" />;

  const { app, database, collection_counts: counts, admin_allowlist: allow } = data;

  const add = async (e) => {
    e.preventDefault();
    try {
      await addAdmin.mutateAsync(email.trim());
      toast(`${email.trim()} added as administrator`);
      setEmail('');
    } catch (err) {
      toast(err.message || 'Failed', 'error');
    }
  };

  const remove = async (addr) => {
    if (!(await confirm(`Remove <strong>${addr}</strong> from the admin allowlist?`, { confirmLabel: 'Remove' }))) return;
    try {
      await removeAdmin.mutateAsync(addr);
      toast('Removed from allowlist');
    } catch (err) {
      toast(err.message || 'Failed', 'error');
    }
  };

  return (
    <>
      <PageHeader title="System Settings" subtitle="Platform configuration and health." />

      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-server" style={{ color: 'var(--primary)', marginRight: 8 }} />Application</h3>
          </div>
          <div className="card-body">
            <ViewGrid
              items={[
                ['Version', app.version],
                ['Environment', app.env],
                ['Node.js', app.node],
                ['Host', app.host],
                ['Uptime', fmtUptime(app.uptime_seconds)],
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-database" style={{ color: 'var(--blue)', marginRight: 8 }} />Database</h3>
          </div>
          <div className="card-body">
            <ViewGrid
              items={[
                ['Name', database.name],
                ['Status', database.state],
                ['Collections', database.collections ?? '—'],
                ['Documents', database.documents != null ? formatNumber(database.documents) : '—'],
                ['Data size', database.data_size_mb != null ? `${database.data_size_mb} MB` : '—'],
                ['Storage size', database.storage_size_mb != null ? `${database.storage_size_mb} MB` : '—'],
              ]}
            />
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-user-shield" style={{ color: 'var(--purple)', marginRight: 8 }} />Administrator allowlist</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>
              Anyone signing in with one of these emails is automatically granted admin. Env-configured
              entries are managed in <code>server/.env</code> and can&apos;t be removed here.
            </p>

            <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="form-control"
                type="email"
                placeholder="new.admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="btn btn-primary" disabled={addAdmin.isPending}>
                <i className="fas fa-plus" /> Add
              </button>
            </form>

            <div>
              {allow.env.map((e) => (
                <div key={e} style={row}>
                  <span>{e} <span className="badge badge-neutral" style={{ marginLeft: 6 }}>env</span></span>
                  <span style={{ color: 'var(--text-light)', fontSize: 12 }}>locked</span>
                </div>
              ))}
              {allow.managed
                .filter((e) => !allow.env.includes(e))
                .map((e) => (
                  <div key={e} style={row}>
                    <span>{e} <span className="badge badge-primary" style={{ marginLeft: 6 }}>managed</span></span>
                    <IconButton icon="fa-trash" title="Remove" danger onClick={() => remove(e)} />
                  </div>
                ))}
              {allow.env.length === 0 && allow.managed.length === 0 && (
                <div style={{ color: 'var(--text-light)', fontSize: 13 }}>No admins configured</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-layer-group" style={{ color: 'var(--primary)', marginRight: 8 }} />Collection counts</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-light)' }}>{k}</span>
                    <strong>{formatNumber(n)}</strong>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const row = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
};
