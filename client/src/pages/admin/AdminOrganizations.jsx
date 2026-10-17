import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, Loading, PageHeader } from '../../components/ui.jsx';
import { Modal } from '../../components/Modal.jsx';
import { FormRow, SelectField, TextField } from '../../components/form.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate, formatNumber } from '../../lib/format.js';
import { reasonText, useAdminOrgMutations, useAdminOrgs, useAdminPlatformStats } from '../../lib/orgApi.js';
import { t } from '../../i18n/index.js';

const TYPES = ['Cooperative', 'NGO', 'Company', 'Government', 'Other'];
const BADGE = { pending: 'badge-warning', active: 'badge-success', suspended: 'badge-danger' };
const TABS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending approval' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
];

function CreateModal({ onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { create } = useAdminOrgMutations();
  const [v, setV] = useState({ name: '', type: 'Cooperative', country: 'Rwanda', district: '', admin_email: '', contact_phone: '', max_farmers: '' });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      const org = await create.mutateAsync(v);
      toast(t('Organization created and active'));
      navigate(`/admin/organizations/${org.id}`);
    } catch (err) {
      toast(reasonText(err), 'error');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Create organization"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn btn-primary" form="org-create" disabled={create.isPending || !v.name.trim()}>{t('Create')}</button>
        </>
      }
    >
      <form id="org-create" onSubmit={submit}>
        <TextField label="Organization name" required value={v.name} onChange={set('name')} />
        <FormRow>
          <SelectField label="Type" value={v.type} onChange={set('type')} options={TYPES} />
          <TextField label="Country" value={v.country} onChange={set('country')} />
        </FormRow>
        <FormRow>
          <TextField label="District" value={v.district} onChange={set('district')} />
          <TextField label="Contact phone" value={v.contact_phone} onChange={set('contact_phone')} />
        </FormRow>
        <FormRow>
          <TextField label="Administrator email" type="email" value={v.admin_email} onChange={set('admin_email')} hint="They become the organization administrator when they sign in with this email." />
          <TextField label="Farmer limit" type="number" value={v.max_farmers} onChange={set('max_farmers')} hint="Empty uses the default." />
        </FormRow>
      </form>
    </Modal>
  );
}

export default function AdminOrganizations() {
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError } = useAdminOrgs({ ...(tab ? { status: tab } : {}), ...(q ? { q } : {}) });
  const { data: stats } = useAdminPlatformStats();

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle="Approve organizations, set their farmer limits and watch usage."
        action={<button className="btn btn-primary" onClick={() => setCreating(true)}><i className="fas fa-plus" /> {t('Create organization')}</button>}
      />

      {stats && (
        <div className="org-tiles">
          <div className="org-tile"><span className="org-tile-label">{t('Organizations')}</span><span className="org-tile-value">{formatNumber((stats.organizations.active || 0) + (stats.organizations.pending || 0) + (stats.organizations.suspended || 0))}</span><span className="org-tile-sub">{stats.organizations.pending || 0} {t('waiting for approval')}</span></div>
          <div className="org-tile"><span className="org-tile-label">{t('Farmers in organizations')}</span><span className="org-tile-value">{formatNumber(stats.farmers_in_organizations)}</span></div>
          <div className="org-tile"><span className="org-tile-label">{t('Independent farmers')}</span><span className="org-tile-value">{formatNumber(stats.independent_farmers)}</span></div>
          <div className="org-tile"><span className="org-tile-label">{t('Farm area')}</span><span className="org-tile-value">{formatNumber(Math.round(stats.hectares.organizations + stats.hectares.independent))} ha</span><span className="org-tile-sub">{formatNumber(Math.round(stats.hectares.organizations))} ha {t('in organizations')}</span></div>
        </div>
      )}

      <div className="report-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {TABS.map((x) => (
          <button key={x.id} className={`btn btn-sm ${tab === x.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(x.id)}>
            {t(x.label)}{x.id && data?.counts?.[x.id] ? ` (${data.counts[x.id]})` : ''}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div className="table-search"><i className="fas fa-search" /><input value={q} placeholder={t('Search organizations...')} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {isLoading ? <Loading /> : isError ? <EmptyState icon="fa-exclamation-triangle" title="Could not load organizations" /> : !data?.data?.length ? (
        <EmptyState icon="fa-building" title="No organizations" description="Organizations appear here when they register, or when you create one." />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>{t('Organization')}</th><th>{t('Type')}</th><th>{t('Status')}</th><th>{t('Farmers')}</th><th>{t('Limit')}</th><th>{t('Team')}</th><th>{t('Registered')}</th></tr></thead>
            <tbody>
              {data.data.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/organizations/${o.id}`}><b>{o.name}</b></Link><br /><span className="org-muted">{[o.district, o.country].filter(Boolean).join(', ')}</span></td>
                  <td>{t(o.type)}</td>
                  <td><span className={`badge ${BADGE[o.status]}`}>{t(o.status)}</span></td>
                  <td>{o.farmer_count}</td>
                  <td>{o.max_farmers} <span className="org-muted">({o.usage_pct}%)</span></td>
                  <td>{o.members}</td>
                  <td>{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </>
  );
}
