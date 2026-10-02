import { Link, useNavigate } from 'react-router-dom';
import { useAdminOverview } from '../../lib/useAdmin.js';
import { PageHeader, Loading, EmptyState, FitValue } from '../../components/ui.jsx';
import { displayName, formatNumber, formatDate, formatDateTime, formatTotals } from '../../lib/format.js';
import { StatusPill, useAccountActions } from './accountActions.jsx';

const RECORD_LABELS = {
  Farm: 'Farms', Field: 'Fields', Crop: 'Crops', CropVariety: 'Varieties', Season: 'Seasons',
  CropCycle: 'Crop cycles', PlantingRecord: 'Planting records', FieldActivity: 'Field activities',
  IrrigationRecord: 'Irrigation records', FertilizerApplication: 'Fertilizer applications',
  CropProtectionRecord: 'Crop protection', CropScoutingRecord: 'Scouting records',
  HarvestRecord: 'Harvest records', InventoryItem: 'Inventory items', InventoryTransaction: 'Stock movements',
  Equipment: 'Equipment', EquipmentMaintenance: 'Maintenance', Expense: 'Expenses', Sale: 'Sales',
  Notification: 'Notifications', CalculationHistory: 'Calculations',
};

function Kpi({ icon, color, label, value, to }) {
  const navigate = useNavigate();
  return (
    <div className="kpi-card" style={{ cursor: to ? 'pointer' : 'default' }} onClick={to ? () => navigate(to) : undefined}>
      <div className={`kpi-icon ${color}`}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="kpi-info">
        <div className="kpi-label">{label}</div>
        <FitValue className="kpi-value" value={value} />
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading, isError } = useAdminOverview();
  const { start, dialog } = useAccountActions();

  if (isLoading) return <Loading label="Loading admin overview..." />;
  if (isError || !data) return <EmptyState icon="fa-exclamation-triangle" title="Could not load overview" />;

  const { users, records, finance, recent_users: recent, pending_requests: requests = [] } = data;
  const totalRecords = Object.values(records).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader title="Admin Overview" subtitle="Platform-wide activity across all users." />

      <div className="kpi-grid">
        <Kpi icon="fa-users" color="green" label="Total Users" value={users.total} />
        <Kpi icon="fa-user-clock" color={users.pending ? 'orange' : 'green'} label="Pending Requests" value={users.pending || 0} to="/admin/users?status=pending" />
        <Kpi icon="fa-user-check" color="blue" label="Active Users" value={users.active} to="/admin/users?status=active" />
        <Kpi icon="fa-user-shield" color="purple" label="Administrators" value={users.admins} />
        <Kpi icon="fa-circle-pause" color={users.on_hold ? 'orange' : 'green'} label="On Hold" value={users.on_hold || 0} to="/admin/users?status=on_hold" />
        <Kpi icon="fa-user-slash" color={users.deactivated ? 'red' : 'green'} label="Deactivated" value={users.deactivated || 0} to="/admin/users?status=deactivated" />
        <Kpi icon="fa-database" color="blue" label="Total Records" value={formatNumber(totalRecords)} />
        <Kpi icon="fa-hand-holding-usd" color="green" label="Sales Value (all users)" value={formatTotals(finance.sales_by_currency)} />
        <Kpi icon="fa-receipt" color="red" label="Expenses (all users)" value={formatTotals(finance.expenses_by_currency)} />
      </div>

      {/* account requests waiting for approval */}
      <div className="chart-card full-width" style={{ marginBottom: 20 }}>
        <div className="chart-card-header">
          <h3><i className="fas fa-user-clock" style={{ color: 'var(--orange)', marginRight: 8 }} />Account requests</h3>
          {users.pending > requests.length && <Link to="/admin/users?status=pending" style={{ fontSize: 13 }}>View all {users.pending}</Link>}
        </div>
        <div className="chart-card-body" style={{ height: 'auto', minHeight: 0, maxHeight: 420, overflowY: 'auto' }}>
          {requests.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13, textAlign: 'center', padding: 24 }}>
              <i className="fas fa-check-circle" style={{ fontSize: 24, color: 'var(--primary)', display: 'block', marginBottom: 8 }} />
              No requests waiting for approval
            </div>
          ) : (
            requests.map((u) => (
              <div key={u.id} className="account-request-row">
                <Link to={`/admin/users/${u.user_id}`} className="account-request-info">
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {displayName(u)} <span className="text-xs text-light">· {u.email || u.user_id}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                    {u.access_request?.account_type} · {u.access_request?.organization}, {u.access_request?.country} · sent {formatDateTime(u.access_request?.submitted_at)}
                  </div>
                </Link>
                <div className="account-request-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => start(u, 'approve')}><i className="fas fa-circle-check" /> Approve</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => start(u, 'hold')}><i className="fas fa-circle-pause" /> Hold</button>
                  <button className="btn btn-sm btn-danger" onClick={() => start(u, 'reject')}><i className="fas fa-circle-xmark" /> Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3><i className="fas fa-layer-group" style={{ color: 'var(--primary)', marginRight: 8 }} />Records by module</h3>
          </div>
          <div className="chart-card-body">
            <div className="detail-grid">
              {Object.entries(records)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-light)' }}>{RECORD_LABELS[k] || k}</span>
                    <strong>{formatNumber(n)}</strong>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3><i className="fas fa-user-clock" style={{ color: 'var(--blue)', marginRight: 8 }} />Recent sign-ups</h3>
          </div>
          <div className="chart-card-body" style={{ maxHeight: 380, overflowY: 'auto' }}>
            {recent.length === 0 ? (
              <div style={{ color: 'var(--text-light)', fontSize: 13, textAlign: 'center', padding: 24 }}>No users yet</div>
            ) : (
              recent.map((u) => (
                <Link
                  key={u.id}
                  to={`/admin/users/${u.user_id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', color: 'inherit' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {displayName(u)}
                      {u.is_admin && <span className="badge badge-primary" style={{ marginLeft: 8 }}>Admin</span>}
                      {!u.is_admin && u.account_status !== 'active' && <span style={{ marginLeft: 6 }}><StatusPill status={u.account_status} /></span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{u.email || '—'} · {u.role}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{formatDate(u.created_at)}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
      {dialog}
    </>
  );
}
