import { Link } from 'react-router-dom';
import { useAdminOverview } from '../../lib/useAdmin.js';
import { PageHeader, Loading, EmptyState } from '../../components/ui.jsx';
import { formatCurrency, formatNumber, formatDate } from '../../lib/format.js';

const RECORD_LABELS = {
  Farm: 'Farms', Field: 'Fields', Crop: 'Crops', CropVariety: 'Varieties', Season: 'Seasons',
  CropCycle: 'Crop cycles', PlantingRecord: 'Planting records', FieldActivity: 'Field activities',
  IrrigationRecord: 'Irrigation records', FertilizerApplication: 'Fertilizer applications',
  CropProtectionRecord: 'Crop protection', CropScoutingRecord: 'Scouting records',
  HarvestRecord: 'Harvest records', InventoryItem: 'Inventory items', InventoryTransaction: 'Stock movements',
  Equipment: 'Equipment', EquipmentMaintenance: 'Maintenance', Expense: 'Expenses', Sale: 'Sales',
  Notification: 'Notifications', CalculationHistory: 'Calculations',
};

function Kpi({ icon, color, label, value }) {
  return (
    <div className="kpi-card" style={{ cursor: 'default' }}>
      <div className={`kpi-icon ${color}`}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="kpi-info">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading, isError } = useAdminOverview();

  if (isLoading) return <Loading label="Loading admin overview..." />;
  if (isError || !data) return <EmptyState icon="fa-exclamation-triangle" title="Could not load overview" />;

  const { users, records, finance, recent_users: recent } = data;
  const totalRecords = Object.values(records).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader title="Admin Overview" subtitle="Platform-wide activity across all users." />

      <div className="kpi-grid">
        <Kpi icon="fa-users" color="green" label="Total Users" value={users.total} />
        <Kpi icon="fa-user-check" color="blue" label="Active Users" value={users.active} />
        <Kpi icon="fa-user-shield" color="purple" label="Administrators" value={users.admins} />
        <Kpi icon="fa-user-slash" color={users.inactive ? 'red' : 'green'} label="Deactivated" value={users.inactive} />
        <Kpi icon="fa-database" color="blue" label="Total Records" value={formatNumber(totalRecords)} />
        <Kpi icon="fa-hand-holding-usd" color="green" label="Sales Value (all users)" value={formatCurrency(finance.sales_total)} />
        <Kpi icon="fa-receipt" color="red" label="Expenses (all users)" value={formatCurrency(finance.expenses_total)} />
        <Kpi icon="fa-user-plus" color="blue" label="Onboarded" value={users.onboarded} />
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3><i className="fas fa-layer-group" style={{ color: 'var(--primary)', marginRight: 8 }} />Records by module</h3>
          </div>
          <div className="chart-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
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
                      {u.full_name || u.email || u.user_id}
                      {u.is_admin && <span className="badge badge-primary" style={{ marginLeft: 8 }}>Admin</span>}
                      {u.is_active === false && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Inactive</span>}
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
    </>
  );
}
