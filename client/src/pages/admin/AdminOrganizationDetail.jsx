import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, Loading, PageHeader, ViewGrid } from '../../components/ui.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDateTime } from '../../lib/format.js';
import { reasonText, useAdminOrg, useAdminOrgMutations } from '../../lib/orgApi.js';
import { UsageMeter } from '../org/OrgGate.jsx';
import { t } from '../../i18n/index.js';

const BADGE = { pending: 'badge-warning', active: 'badge-success', suspended: 'badge-danger' };
const LINK_BADGE = { active: 'badge-success', expired: 'badge-neutral', revoked: 'badge-danger', full: 'badge-warning' };
const RESULT = {
  joined: 'Joined', not_registered: 'No account with this email', already_member: 'Already a member', other_org: 'In another organization',
  org_limit: 'Limit reached', limit_reached: 'Not tried, limit reached', invalid_email: 'Not an email address', not_a_farmer: 'Not a farmer account', error: 'Error',
};

export default function AdminOrganizationDetail() {
  const { orgId: id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: o, isLoading, isError } = useAdminOrg(id);
  const { patch, remove, importFarmers } = useAdminOrgMutations();
  const [limit, setLimit] = useState('');
  const [reason, setReason] = useState('');
  const [csv, setCsv] = useState('');
  const [consent, setConsent] = useState(false);
  const [report, setReport] = useState(null);

  if (isLoading) return <Loading />;
  if (isError || !o) return <EmptyState icon="fa-exclamation-triangle" title="Organization not found" />;

  const act = async (body, ok) => {
    try { await patch.mutateAsync({ id, ...body }); toast(t(ok)); if (body.max_farmers !== undefined) { setReason(''); setLimit(''); } } catch (err) { toast(reasonText(err), 'error'); }
  };
  const suspend = async () => {
    const why = window.prompt(t('Why is {{name}} being suspended?', { name: o.name }), '');
    if (why === null) return;
    await act({ action: 'suspend', reason: why }, 'Organization suspended');
  };
  const del = async () => {
    if (!(await confirm(t('Delete <strong>{{name}}</strong>? Its farmers are unlinked (their data stays with them), its links stop working and its team loses access.', { name: o.name }), { confirmLabel: t('Delete') }))) return;
    try { await remove.mutateAsync(id); toast(t('Organization deleted')); navigate('/admin/organizations'); } catch (err) { toast(reasonText(err), 'error'); }
  };
  const runImport = async () => {
    try { setReport(await importFarmers.mutateAsync({ id, csv, consent_confirmed: consent })); toast(t('Import finished')); } catch (err) { toast(reasonText(err), 'error'); }
  };

  return (
    <>
      <PageHeader
        title={o.name}
        subtitle={`${t(o.type)} · ${[o.district, o.country].filter(Boolean).join(', ')}`}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {o.status === 'pending' && <button className="btn btn-primary" onClick={() => act({ action: 'approve' }, 'Organization approved')}><i className="fas fa-check" /> {t('Approve')}</button>}
            {o.status === 'active' && <button className="btn btn-secondary" onClick={suspend}><i className="fas fa-ban" /> {t('Suspend')}</button>}
            {o.status === 'suspended' && <button className="btn btn-primary" onClick={() => act({ action: 'reactivate' }, 'Organization reactivated')}><i className="fas fa-rotate-left" /> {t('Reactivate')}</button>}
            <button className="btn btn-danger" onClick={del}><i className="fas fa-trash" /> {t('Delete')}</button>
          </div>
        }
      />
      <p><Link to="/admin/organizations">&larr; {t('All organizations')}</Link> <span className={`badge ${BADGE[o.status]}`} style={{ marginLeft: 8 }}>{t(o.status)}</span></p>

      <div className="chart-grid">
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-gauge" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Farmer limit')}</h3></div>
          <div className="card-body">
            <UsageMeter count={o.farmer_count} max={o.max_farmers} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16 }}>
              <div className="form-group" style={{ margin: 0, width: 130 }}>
                <label className="form-label">{t('New limit')}</label>
                <input className="form-control" type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={String(o.max_farmers)} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
                <label className="form-label">{t('Reason (recorded in the audit log)')}</label>
                <input className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={limit === '' || !reason.trim() || patch.isPending} onClick={() => act({ max_farmers: Number(limit), reason }, 'Farmer limit updated')}>{t('Save limit')}</button>
            </div>
            <p className="org-muted" style={{ marginTop: 10 }}>{t('Lowering the limit below the current number keeps existing farmers but blocks new ones.')}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-building" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Details')}</h3></div>
          <div className="card-body">
            <ViewGrid items={[['Contact email', o.contact_email], ['Contact phone', o.contact_phone], ['Sector', o.sector], ['Registered', formatDateTime(o.created_at)], ['Approved', o.approved_at ? formatDateTime(o.approved_at) : '—'], ['Suspended because', o.suspended_reason || '—']]} />
          </div>
        </div>
      </div>

      <div className="chart-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-users" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Team')}</h3></div>
          <div className="card-body">
            {o.members.length ? o.members.map((m) => (
              <div key={m.id} className="org-line"><span><b>{m.name || m.email}</b> <span className="org-muted">{m.name ? m.email : ''}</span></span><span className="badge badge-neutral">{t(m.role === 'org_admin' ? 'Administrator' : 'Field officer')}{m.status === 'invited' ? ` · ${t('Invited')}` : ''}</span></div>
            )) : <p className="org-muted">{t('No team members yet.')}</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3><i className="fas fa-link" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Referral links')}</h3></div>
          <div className="card-body">
            {o.links.length ? o.links.map((l) => (
              <div key={l.id} className="org-line"><span>{l.label || t('Referral link')} <span className="org-muted">{formatDateTime(l.created_at)} · {l.use_count}{l.max_uses ? `/${l.max_uses}` : ''}</span></span><span className={`badge ${LINK_BADGE[l.status]}`}>{t(l.status)}</span></div>
            )) : <p className="org-muted">{t('No links yet.')}</p>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3><i className="fas fa-file-import" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Add existing farmers by email')}</h3></div>
        <div className="card-body">
          <p className="org-muted">{t('Paste one email per line (or a CSV with an email column). The farmers must already have a CropManager account. The farmer limit applies.')}</p>
          <textarea className="form-control" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'email\nfarmer@example.com'} />
          <label className="org-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t('I confirm these farmers have agreed to share a summary of their crop activity with this organization.')}</span>
          </label>
          <button className="btn btn-primary" disabled={!csv.trim() || !consent || importFarmers.isPending || o.status !== 'active'} onClick={runImport}>{importFarmers.isPending ? t('Importing…') : t('Import farmers')}</button>
          {report && (
            <div style={{ marginTop: 12 }}>
              <p><b>{t('{{count}} farmers joined.', { count: report.joined })}</b></p>
              <ul className="org-list">{report.rows.filter((r) => r.result !== 'joined').slice(0, 50).map((r, i) => <li key={i}>{r.email}: <span className="org-muted">{t(RESULT[r.result] || r.result)}</span></li>)}</ul>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3><i className="fas fa-clipboard-list" style={{ color: 'var(--primary)', marginRight: 8 }} />{t('Recent history')}</h3></div>
        <div className="card-body">
          {o.audit.length ? o.audit.map((a) => (
            <div key={a.id} className="org-line"><span><b>{a.action}</b> <span className="org-muted">{a.actor}</span></span><span className="org-muted">{formatDateTime(a.created_at)}</span></div>
          )) : <p className="org-muted">{t('Nothing recorded yet.')}</p>}
          <p style={{ marginTop: 10 }}><Link to="/admin/audit">{t('Open the full audit log')}</Link></p>
        </div>
      </div>
    </>
  );
}
