import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, IconButton, Loading, PageHeader, Pagination } from '../../components/ui.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate } from '../../lib/format.js';
import { downloadFarmersCsv, reasonText, useOrgFarmers, useOrgMutations } from '../../lib/orgApi.js';
import { OrgGate } from './OrgGate.jsx';
import { t } from '../../i18n/index.js';

const PER = 25;

function Body({ org, role }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [page, setPage] = useState(1);
  const filters = { q: sp.get('q') || '', crop: sp.get('crop') || '', inactive: sp.get('inactive') || '', joined_from: sp.get('joined_from') || '', district: sp.get('district') || '' };
  const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, perPage: PER };
  const { data, isLoading, isError, refetch } = useOrgFarmers(org.id, params);
  const { removeFarmer } = useOrgMutations(org.id);

  const update = (k, v) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v); else next.delete(k);
    setSp(next, { replace: true });
    setPage(1);
  };
  const remove = async (f) => {
    if (!(await confirm(t('Remove <strong>{{name}}</strong> from {{org}}? They keep their account and data, and can rejoin with a new link.', { name: f.name, org: org.name }), { confirmLabel: t('Remove') }))) return;
    try {
      await removeFarmer.mutateAsync({ farmerId: f.farmer_id });
      toast(t('Farmer removed'));
    } catch (err) {
      toast(reasonText(err), 'error');
    }
  };
  const exportCsv = async () => {
    try {
      await downloadFarmersCsv(org.id, Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
    } catch (err) {
      toast(reasonText(err), 'error');
    }
  };

  const active = Object.entries(filters).filter(([k, v]) => v && k !== 'q');
  return (
    <>
      <PageHeader
        title="Farmers"
        subtitle="Farmers linked to your organization."
        action={<button className="btn btn-secondary" onClick={exportCsv}><i className="fas fa-file-csv" /> {t('Export CSV')}</button>}
      />
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <div className="table-search">
            <i className="fas fa-search" />
            <input value={q} placeholder={t('Search name, location or crop...')} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && update('q', q)} onBlur={() => update('q', q)} />
          </div>
          <label className="org-check">
            <input type="checkbox" checked={filters.inactive === '1'} onChange={(e) => update('inactive', e.target.checked ? '1' : '')} /> {t('No recent activity')}
          </label>
        </div>
      </div>
      {active.length > 0 && (
        <div className="org-chips">
          {active.map(([k, v]) => (
            <button key={k} className="farm-profile-chip active" onClick={() => update(k, '')}>
              {k === 'inactive' ? t('No recent activity') : `${t(k === 'joined_from' ? 'Joined since' : k === 'crop' ? 'Crop' : 'District')}: ${v}`} <i className="fas fa-times" />
            </button>
          ))}
        </div>
      )}

      {isLoading ? <Loading /> : isError ? (
        <EmptyState icon="fa-exclamation-triangle" title="Could not load farmers" actionLabel="Retry" onAction={refetch} />
      ) : !data?.data?.length ? (
        <EmptyState icon="fa-users" title="No farmers yet" description="Create a referral link and share it with your farmers. They appear here when they join." />
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>{t('Name')}</th><th>{t('Location')}</th><th>{t('Farm size')}</th><th>{t('Main crops')}</th><th>{t('Joined')}</th><th>{t('Last activity')}</th>{role === 'org_admin' && <th>{t('Actions')}</th>}</tr>
              </thead>
              <tbody>
                {data.data.map((f) => (
                  <tr key={f.farmer_id}>
                    <td><b>{f.name}</b></td>
                    <td>{f.location || '—'}</td>
                    <td>{f.farms ? `${Math.round(f.farm_ha * 10) / 10} ha · ${t(f.farms === 1 ? '{{count}} farm' : '{{count}} farms', { count: f.farms })}` : '—'}</td>
                    <td>{f.crops.length ? f.crops.join(', ') : '—'}</td>
                    <td>{formatDate(f.joined_at)}</td>
                    <td>{f.last_activity ? formatDate(f.last_activity) : <span className="badge badge-warning">{t('none')}</span>}</td>
                    {role === 'org_admin' && <td><IconButton icon="fa-user-minus" title="Remove" danger onClick={() => remove(f)} /></td>}
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

export default function OrgFarmers() {
  return <OrgGate>{(p) => <Body {...p} />}</OrgGate>;
}
