import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { formatDate, formatNumber } from '../../lib/format.js';
import { t } from '../../i18n/index.js';

/*
 * The part of the home page that depends on the account type: what a farmer, farm manager, agronomist or cooperative manager needs to
 * look at first. Everything comes from one server request (GET /dashboard/role). It sits above the common dashboard and never replaces it.
 */
const useRoleSummary = () =>
  useQuery({ queryKey: ['dashboard', 'role'], queryFn: () => api.get('/dashboard/role').then((r) => r.data), staleTime: 60_000 });

function Card({ icon, tone, title, count, to, children, empty }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3>
          <i className={`fas ${icon}`} style={{ color: tone, marginRight: 8 }} />
          {t(title)}{typeof count === 'number' && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>{formatNumber(count)}</span>}
        </h3>
        {to && <Link to={to} className="btn btn-secondary btn-sm">{t('Open')}</Link>}
      </div>
      <div className="chart-card-body" style={{ minHeight: 0 }}>
        {count === 0 ? <p className="org-muted" style={{ margin: 0 }}>{t(empty || 'Nothing needs attention.')}</p> : children}
      </div>
    </div>
  );
}

const Rows = ({ rows, render }) => (
  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
    {rows.map((r, i) => <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>{render(r)}</li>)}
  </ul>
);
const Muted = ({ children }) => <span className="org-muted">{children}</span>;

function Operations({ o, showMoney }) {
  return (
    <>
      <Card icon="fa-hourglass-end" tone="#C62828" title="Harvests past their date" count={o.overdue_count} to="/crop-cycles" empty="No harvest is late.">
        <Rows rows={o.overdue_harvests} render={(r) => <><b>{r.crop}</b><Muted>{formatDate(r.due)}</Muted></>} />
      </Card>
      <Card icon="fa-wheat-awn" tone="#2E7D32" title="Harvest in the next 14 days" count={o.harvest_soon_count} to="/crop-cycles" empty="No harvest due soon.">
        <Rows rows={o.harvest_soon} render={(r) => <><b>{r.crop}</b><Muted>{formatDate(r.due)}</Muted></>} />
      </Card>
      <Card icon="fa-boxes" tone="#F9A825" title="Stock running low" count={o.low_stock_count} to="/inventory" empty="Stock levels are fine.">
        <Rows rows={o.low_stock} render={(r) => <><b>{r.name}</b><Muted>{r.quantity} / {r.minimum} {r.unit}</Muted></>} />
      </Card>
      {showMoney && (
        <Card icon="fa-wrench" tone="#5B6B5D" title="Machines due for service" count={o.maintenance_due_count} to="/maintenance" empty="No service is due.">
          <Rows rows={o.maintenance_due} render={(r) => <><b>{r.name}</b><Muted>{r.overdue ? `${t('Late')} · ` : ''}{formatDate(r.due)}</Muted></>} />
        </Card>
      )}
    </>
  );
}

function Spending({ o }) {
  const up = o.spending.this_month > o.spending.last_month;
  return (
    <div className="chart-card">
      <div className="chart-card-header"><h3><i className="fas fa-receipt" style={{ color: '#1B5E20', marginRight: 8 }} />{t('Work and spending')}</h3><Link to="/expenses" className="btn btn-secondary btn-sm">{t('Open')}</Link></div>
      <div className="chart-card-body" style={{ minHeight: 0, display: 'grid', gap: 6 }}>
        <div><b>{formatNumber(o.spending.this_month)}</b> <Muted>{t('spent this month')}</Muted> <span className={`badge ${up ? 'badge-warning' : 'badge-success'}`}>{up ? '↑' : '↓'} {formatNumber(o.spending.last_month)} {t('last month')}</span></div>
        <div><b>{o.work_this_week.activities}</b> <Muted>{t('field activities in the last 7 days')}</Muted></div>
      </div>
    </div>
  );
}

function CropHealth({ h }) {
  return (
    <>
      <Card icon="fa-bug" tone="#C62828" title="Problems found in the last 30 days" count={h.problems_count} to="/scouting" empty="No pest or disease reported.">
        <Rows rows={h.problems_found} render={(r) => <><span><b>{t(r.kind)}</b> {r.crop && `· ${r.crop}`}<br /><Muted>{r.note}</Muted></span><Muted>{formatDate(r.date)}</Muted></>} />
      </Card>
      <Card icon="fa-triangle-exclamation" tone="#E65100" title="Serious cases" count={h.serious_count} to="/crop-protection" empty="No serious case.">
        <Rows rows={h.serious_issues} render={(r) => <><span><b>{r.name}</b> <span className="badge badge-danger">{t(r.severity)}</span></span><Muted>{formatDate(r.date)}</Muted></>} />
      </Card>
      <Card icon="fa-magnifying-glass" tone="#2E7D32" title="Crops not scouted for 14 days" count={h.needs_visit_count} to="/scouting" empty="Every growing crop was scouted recently.">
        <Rows rows={h.needs_visit} render={(r) => <><b>{r.crop}</b><Muted>{t(r.status)}</Muted></>} />
      </Card>
      <div className="chart-card">
        <div className="chart-card-header"><h3><i className="fas fa-wand-magic-sparkles" style={{ color: '#1B5E20', marginRight: 8 }} />{t('Photo diagnoses')}</h3><Link to="/assistant" className="btn btn-secondary btn-sm">{t('Open')}</Link></div>
        <div className="chart-card-body" style={{ minHeight: 0 }}><b>{h.diagnoses_30d}</b> <Muted>{t('in the last 30 days')}</Muted> · <b>{h.healthy_visits}</b> <Muted>{t('healthy scouting visits')}</Muted></div>
      </div>
    </>
  );
}

const TITLES = {
  Farmer: ['What needs your attention', 'This week on your farm.'],
  'Farm Manager': ['Running the farm', 'Work, stock, machines and spending at a glance.'],
  Agronomist: ['Crop health', 'Problems found, serious cases and crops that need a visit.'],
  'Cooperative Manager': ['Your cooperative', 'Your own farm first, and the tools to manage your members.'],
};

export function RoleSummary() {
  const { data, isLoading, isError } = useRoleSummary();
  if (isLoading || isError || !data) return null; // the common dashboard below still works without it
  const [title, sub] = TITLES[data.role] || TITLES.Farmer;
  return (
    <section aria-label={t(title)} style={{ marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 2px', fontSize: '1.15rem' }}>{t(title)}</h2>
      <p className="org-muted" style={{ margin: '0 0 12px' }}>{t(sub)}</p>
      {data.organization && (
        <div className="chart-card" style={{ marginBottom: 12 }}>
          <div className="chart-card-body" style={{ minHeight: 0, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span><i className="fas fa-people-group" style={{ color: '#1B5E20', marginRight: 8 }} />
              {data.organization.has_workspace ? t('Open your organization to manage farmers, invitations and your team.') : t('Cooperatives manage their farmers from an organization account: invite farmers, follow their crops and see the whole picture. Register one with a separate organization account.')}
            </span>
            <Link className="btn btn-primary" to={data.organization.has_workspace ? '/org' : data.organization.register_path}>{data.organization.has_workspace ? t('Open organization') : t('Register an organization')}</Link>
          </div>
        </div>
      )}
      <div className="dashboard-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {data.crop_health && <CropHealth h={data.crop_health} />}
        {data.operations && <Operations o={data.operations} showMoney={data.role !== 'Agronomist' && data.role !== 'Farmer'} />}
        {data.operations && data.role !== 'Agronomist' && data.role !== 'Farmer' && <Spending o={data.operations} />}
      </div>
    </section>
  );
}
