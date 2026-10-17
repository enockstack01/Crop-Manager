import { useState } from 'react';
import { EmptyState, Loading, PageHeader, Pagination } from '../../components/ui.jsx';
import { formatDateTime } from '../../lib/format.js';
import { useAdminAudit } from '../../lib/orgApi.js';
import { t } from '../../i18n/index.js';

const ACTIONS = [
  'organization.registered', 'organization.created', 'organization.approved', 'organization.suspended', 'organization.reactivated',
  'organization.limit_changed', 'organization.updated', 'organization.deleted', 'referral_link.created', 'referral_link.revoked',
  'farmer.joined', 'farmer.left', 'farmer.removed', 'farmers.imported', 'farmers.exported', 'member.invited', 'member.removed', 'settings.updated', 'user.deleted',
];
const PER = 25;

export default function AdminAudit() {
  const [f, setF] = useState({ action: '', q: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const params = { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page, perPage: PER };
  const { data, isLoading, isError } = useAdminAudit(params);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who did what: approvals, limits, links, farmers and team changes." />
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <select className="table-filter-select" value={f.action} onChange={set('action')}>
            <option value="">{t('All actions')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="table-search"><i className="fas fa-search" /><input value={f.q} placeholder={t('Search person or id...')} onChange={set('q')} /></div>
          <input type="date" className="table-filter-select" value={f.from} onChange={set('from')} aria-label={t('From')} />
          <input type="date" className="table-filter-select" value={f.to} onChange={set('to')} aria-label={t('To')} />
        </div>
      </div>
      {isLoading ? <Loading /> : isError ? <EmptyState icon="fa-exclamation-triangle" title="Could not load the audit log" /> : !data?.data?.length ? (
        <EmptyState icon="fa-clipboard-list" title="Nothing recorded" description="Actions on organizations appear here." />
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>{t('Time')}</th><th>{t('Action')}</th><th>{t('By')}</th><th>{t('Organization')}</th><th>{t('Details')}</th></tr></thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</td>
                    <td><b>{a.action}</b></td>
                    <td>{a.actor || '—'}</td>
                    <td>{a.organization || '—'}</td>
                    <td className="org-detail">{a.details && Object.keys(a.details).length ? JSON.stringify(a.details) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={Math.max(1, Math.ceil(data.total / PER))} onChange={setPage} />
        </>
      )}
    </>
  );
}
