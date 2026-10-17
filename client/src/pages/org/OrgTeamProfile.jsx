import { useState } from 'react';
import { EmptyState, IconButton, Loading, PageHeader } from '../../components/ui.jsx';
import { FormRow, SelectField, TextField } from '../../components/form.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useToast } from '../../components/Toast.jsx';
import { reasonText, useOrgMembers, useOrgMutations } from '../../lib/orgApi.js';
import { OrgGate, UsageMeter } from './OrgGate.jsx';
import { t } from '../../i18n/index.js';

const ROLES = [
  { value: 'org_staff', label: 'Field officer' },
  { value: 'org_admin', label: 'Administrator' },
];
const TYPES = ['Cooperative', 'NGO', 'Company', 'Government', 'Other'];
const STATUS_BADGE = { pending: 'badge-warning', active: 'badge-success', suspended: 'badge-danger' };

function TeamBody({ org }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: members, isLoading } = useOrgMembers(org.id);
  const { invite, removeMember } = useOrgMutations(org.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('org_staff');

  const send = async (e) => {
    e.preventDefault();
    try {
      await invite.mutateAsync({ email, role });
      toast(t('Invitation saved. They join when they sign in with {{email}}.', { email }));
      setEmail('');
    } catch (err) {
      toast(reasonText(err), 'error');
    }
  };
  const remove = async (m) => {
    if (!(await confirm(t('Remove <strong>{{name}}</strong> from the team?', { name: m.name || m.email }), { confirmLabel: t('Remove') }))) return;
    try { await removeMember.mutateAsync(m.id); toast(t('Team member removed')); } catch (err) { toast(reasonText(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Team" subtitle="Administrators manage the organization. Field officers create referral links and view farmers." />
      <form className="card org-form" onSubmit={send}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 240px' }}>
            <label className="form-label">{t('Email address')}</label>
            <input className="form-control" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="form-group" style={{ margin: 0, width: 190 }}>
            <label className="form-label">{t('Role')}</label>
            <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={invite.isPending}><i className="fas fa-user-plus" /> {t('Invite')}</button>
        </div>
      </form>

      {isLoading ? <Loading /> : !members?.length ? <EmptyState icon="fa-users" title="No team members" /> : (
        <div className="table-responsive" style={{ marginTop: 20 }}>
          <table className="data-table">
            <thead><tr><th>{t('Name')}</th><th>{t('Email')}</th><th>{t('Role')}</th><th>{t('Status')}</th><th>{t('Actions')}</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.name || '—'}</b></td>
                  <td>{m.email}</td>
                  <td>{t(ROLES.find((r) => r.value === m.role)?.label || m.role)}</td>
                  <td><span className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{t(m.status === 'invited' ? 'Invited' : 'Active')}</span></td>
                  <td><IconButton icon="fa-user-minus" title="Remove" danger onClick={() => remove(m)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ProfileBody({ org }) {
  const toast = useToast();
  const { update } = useOrgMutations(org.id);
  const [v, setV] = useState({ name: org.name, type: org.type, country: org.country || '', district: org.district || '', sector: org.sector || '', contact_email: org.contact_email || '', contact_phone: org.contact_phone || '' });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try { await update.mutateAsync(v); toast(t('Organization updated')); } catch (err) { toast(reasonText(err), 'error'); }
  };
  return (
    <>
      <PageHeader title="Organization" subtitle="Your organization profile and farmer limit." />
      <div className="chart-grid">
        <form className="card" onSubmit={save}>
          <div className="card-header"><h3><i className="fas fa-building" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Profile')}</h3></div>
          <div className="card-body">
            <TextField label="Organization name" required value={v.name} onChange={set('name')} />
            <FormRow>
              <SelectField label="Type" value={v.type} onChange={set('type')} options={TYPES} />
              <TextField label="Country" value={v.country} onChange={set('country')} />
            </FormRow>
            <FormRow>
              <TextField label="District" value={v.district} onChange={set('district')} />
              <TextField label="Sector" value={v.sector} onChange={set('sector')} />
            </FormRow>
            <FormRow>
              <TextField label="Contact email" type="email" value={v.contact_email} onChange={set('contact_email')} />
              <TextField label="Contact phone" value={v.contact_phone} onChange={set('contact_phone')} />
            </FormRow>
            <button className="btn btn-primary" disabled={update.isPending}>{t('Save changes')}</button>
          </div>
        </form>
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-gauge" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Status and limit')}</h3></div>
          <div className="card-body">
            <p><span className={`badge ${STATUS_BADGE[org.status]}`}>{t(org.status)}</span></p>
            <div className="farm-profile-section" style={{ marginTop: 16 }}>{t('Farmer limit')}</div>
            <UsageMeter count={org.farmer_count} max={org.max_farmers} />
            <p className="org-muted" style={{ marginTop: 12 }}>{t('Only a CropManager administrator can change the farmer limit. Contact support to raise it.')}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export const OrgTeam = () => <OrgGate adminOnly>{(p) => <TeamBody {...p} />}</OrgGate>;
export const OrgProfile = () => <OrgGate>{(p) => <ProfileBody {...p} />}</OrgGate>;
