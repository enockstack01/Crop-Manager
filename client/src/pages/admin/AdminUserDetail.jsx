import { useParams, useNavigate } from 'react-router-dom';
import { useAdminUser, useAdminUserMutations } from '../../lib/useAdmin.js';
import { useProfile } from '../../components/profile.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { PageHeader, Loading, EmptyState, ViewGrid } from '../../components/ui.jsx';
import { SelectField } from '../../components/form.jsx';
import { displayName, formatDate, formatDateTime, formatNumber } from '../../lib/format.js';
import { USER_ROLES } from '../../lib/options.js';
import { ACTIONS, StatusPill, actionsFor, useAccountActions } from './accountActions.jsx';
import { t } from '../../i18n/index.js';

const RECORD_LABELS = {
  Farm: 'Farms', Field: 'Fields', Crop: 'Crops', CropVariety: 'Varieties', Season: 'Seasons',
  CropCycle: 'Crop cycles', PlantingRecord: 'Planting', FieldActivity: 'Activities',
  IrrigationRecord: 'Irrigation', FertilizerApplication: 'Fertilizer', CropProtectionRecord: 'Crop protection',
  CropScoutingRecord: 'Scouting', HarvestRecord: 'Harvests', InventoryItem: 'Inventory',
  InventoryTransaction: 'Stock movements', Equipment: 'Equipment', EquipmentMaintenance: 'Maintenance',
  Expense: 'Expenses', Sale: 'Sales', Notification: 'Notifications', CalculationHistory: 'Calculations',
};

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile: me } = useProfile();
  const { data: u, isLoading, isError } = useAdminUser(userId);
  const { update, remove, reseed } = useAdminUserMutations();
  const { start, dialog } = useAccountActions();

  if (isLoading) return <Loading />;
  if (isError || !u) return <EmptyState icon="fa-exclamation-triangle" title="User not found" />;

  const isSelf = userId === me?.user_id;
  const patch = async (body, msg) => {
    try {
      await update.mutateAsync({ userId, ...body });
      toast(msg || 'Updated');
    } catch (e) {
      toast(e.message || 'Failed', 'error');
    }
  };

  const del = async () => {
    const ok = await confirm(
      `Permanently delete <strong>${u.full_name || u.email}</strong> and all their data?`
    );
    if (!ok) return;
    try {
      const res = await remove.mutateAsync(userId);
      toast(`Deleted user and ${res.documents_removed} records`);
      navigate('/admin/users');
    } catch (e) {
      toast(e.message || 'Failed', 'error');
    }
  };

  const doReseed = async () => {
    const ok = await confirm(
      `Replace <strong>${u.full_name || u.email}</strong>'s data with a fresh demo dataset? Existing records are removed first.`,
      { confirmLabel: 'Re-seed', danger: false }
    );
    if (!ok) return;
    try {
      const res = await reseed.mutateAsync(userId);
      toast(`Seeded ${res.total} records`);
    } catch (e) {
      toast(e.message || 'Failed', 'error');
    }
  };

  const counts = u.counts || {};
  const totalRecords = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader
        title={displayName(u)}
        subtitle={u.email || u.user_id}
        action={
          <button className="btn btn-secondary" onClick={() => navigate('/admin/users')}>
            <i className="fas fa-arrow-left" /> {t('Back to users')}
          </button>
        }
      />

      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-id-card" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Account')}</h3>
          </div>
          <div className="card-body">
            <ViewGrid
              items={[
                ['Full name', u.full_name || '—'],
                ['Email', u.email],
                ['Account type', u.role],
                ['Currency', u.currency || 'USD'],
                ['Phone', u.phone],
                ['Location', u.location],
                ['Clerk user id', u.user_id],
                ['Joined', formatDate(u.created_at)],
                ['Last seen', u.last_seen_at ? formatDateTime(u.last_seen_at) : '—'],
                ['Total records', formatNumber(totalRecords)],
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-user-shield" style={{ color: 'var(--purple)', marginRight: 8 }} />{t('Access control')}</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{t('Administrator')}</label>
              <div>
                <button
                  className={`btn ${u.is_admin ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={isSelf}
                  onClick={() => patch({ is_admin: !u.is_admin }, u.is_admin ? 'Admin revoked' : 'Admin granted')}
                >
                  {u.is_admin ? 'Revoke admin access' : 'Grant admin access'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Account status')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <StatusPill status={u.account_status} />
                {u.status_updated_at && (
                  <span className="text-xs text-light">since {formatDateTime(u.status_updated_at)}</span>
                )}
              </div>
              {u.status_reason && (
                <div className="form-hint" style={{ marginTop: 6 }}>Note to user: {u.status_reason}</div>
              )}
              {!isSelf && !u.is_admin && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {actionsFor(u.account_status).map((key) => (
                    <button key={key} className={`btn btn-sm ${ACTIONS[key].btn}`} onClick={() => start(u, key)}>
                      <i className={`fas ${ACTIONS[key].icon}`} /> {ACTIONS[key].label}
                    </button>
                  ))}
                </div>
              )}
              {u.is_admin && <div className="form-hint">{t('Administrators always have access.')}</div>}
            </div>
            <SelectField
              label="Account type"
              value={u.role || 'Farmer'}
              onChange={(e) => patch({ role: e.target.value }, 'Account type updated')}
              options={USER_ROLES}
            />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={doReseed} disabled={reseed.isPending}>
                <i className="fas fa-seedling" /> {t('Re-seed demo data')}
              </button>
              {!isSelf && (
                <button className="btn btn-danger" onClick={del}>
                  <i className="fas fa-trash" /> {t('Delete user & all data')}
                </button>
              )}
            </div>
            {isSelf && <p className="form-hint">{t('You cannot change your own access here.')}</p>}
          </div>
        </div>
      </div>

      {u.access_request && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3><i className="fas fa-file-signature" style={{ color: 'var(--orange)', marginRight: 8 }} />{t('Account request')}</h3>
          </div>
          <div className="card-body">
            <ViewGrid
              items={[
                ['Requested account type', u.access_request.account_type],
                ['Farm / organisation', u.access_request.organization],
                ['Country', u.access_request.country],
                ['Location', u.location],
                ['Farm size', u.access_request.farm_size != null ? `${formatNumber(u.access_request.farm_size)} ${u.access_request.farm_size_unit || ''}` : '—'],
                ['Main crops', u.access_request.main_crops || '—'],
                ['Phone', u.phone || '—'],
                ['Sent', formatDateTime(u.access_request.submitted_at)],
                ['Message', u.access_request.message || '—', true],
              ]}
            />
          </div>
        </div>
      )}

      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-layer-group" style={{ color: 'var(--blue)', marginRight: 8 }} />{t('Data breakdown')}</h3>
          </div>
          <div className="card-body">
            {totalRecords === 0 ? (
              <div style={{ color: 'var(--text-light)', fontSize: 13 }}>{t('No records')}</div>
            ) : (
              <div className="detail-grid">
                {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-light)' }}>{RECORD_LABELS[k] || k}</span>
                    <strong>{formatNumber(n)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><i className="fas fa-clock-rotate-left" style={{ color: 'var(--purple)', marginRight: 8 }} />{t('Recent activity')}</h3>
          </div>
          <div className="card-body" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {(u.recent_harvests || []).map((h) => (
              <div key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <i className="fas fa-wheat-awn" style={{ color: 'var(--primary)', marginRight: 8 }} />
                Harvested {formatNumber(h.quantity)} kg {h.crop_id?.name ? `of ${h.crop_id.name}` : ''} · {formatDate(h.harvest_date)}
              </div>
            ))}
            {(u.recent_activities || []).map((a) => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <i className="fas fa-tasks" style={{ color: 'var(--blue)', marginRight: 8 }} />
                {a.activity_type} · {formatDate(a.activity_date)}
              </div>
            ))}
            {!(u.recent_harvests || []).length && !(u.recent_activities || []).length && (
              <div style={{ color: 'var(--text-light)', fontSize: 13 }}>{t('No recent activity')}</div>
            )}
          </div>
        </div>
      </div>
      {dialog}
    </>
  );
}
