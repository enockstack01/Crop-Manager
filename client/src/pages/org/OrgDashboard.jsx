import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { EmptyState, Loading, PageHeader } from '../../components/ui.jsx';
import { baseOptions, breakdownOptions, LEAF, useIsDark } from '../../features/dashboard/charts.jsx';
import { formatDate, formatNumber } from '../../lib/format.js';
import { useOrgDashboard } from '../../lib/orgApi.js';
import { OrgGate, UsageMeter } from './OrgGate.jsx';
import { OrgMap } from './OrgMap.jsx';
import { t } from '../../i18n/index.js';

const ha = (v) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} ha`;
const kg = (v) => (v >= 1000 ? `${(Math.round(v / 100) / 10).toLocaleString('en-US')} t` : `${Math.round(v).toLocaleString('en-US')} kg`);
const STAGES = [
  { key: 'Planned', label: 'Planned', color: '#5B6B5D' },
  { key: 'Planted', label: 'Planted', color: '#1B5E20' },
  { key: 'Growing', label: 'Growing', color: '#2E7D32' },
  { key: 'Ready for Harvest', label: 'Ready to harvest', color: '#F9A825' },
];

function Card({ title, icon, children, right, className = '' }) {
  return (
    <div className={`chart-card ${className}`} style={{ marginBottom: 20 }}>
      <div className="chart-card-header">
        <h3><i className={`fas ${icon}`} style={{ color: 'var(--primary)', marginRight: 8 }} />{t(title)}</h3>
        {right}
      </div>
      <div className="chart-card-body" style={{ minHeight: 0 }}>{children}</div>
    </div>
  );
}

function Tile({ label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className="org-tile" onClick={onClick}>
      <span className="org-tile-label">{t(label)}</span>
      <span className="org-tile-value">{value}</span>
      {sub ? <span className="org-tile-sub">{sub}</span> : null}
    </Tag>
  );
}

function Body({ org }) {
  const navigate = useNavigate();
  const dark = useIsDark();
  const [filters, setFilters] = useState({ from: '', to: '', district: '' });
  const [districts, setDistricts] = useState([]);
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const { data: d, isLoading, isError, refetch, isFetching } = useOrgDashboard(org.id, params);

  // the district list comes from the unfiltered view so it does not shrink once a district is chosen
  useEffect(() => {
    if (d && !filters.district) setDistricts(d.land.by_district.map((x) => x.district).filter((x) => x && x !== '—'));
  }, [d, filters.district]);

  if (isLoading) return <Loading label="Loading dashboard..." />;
  if (isError || !d) return <EmptyState icon="fa-exclamation-triangle" title="Could not load the dashboard" actionLabel="Retry" onAction={refetch} />;

  const o = d.overview;
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const goFarmers = (q) => navigate(`/org/farmers?${new URLSearchParams(q).toString()}`);
  const cropsBar = d.crops.slice(0, 10);
  const total = o.farmers;

  return (
    <>
      <div className="dashboard-header no-print">
        <PageHeader title={org.name} subtitle="A summary of the crop activity on your farmers' farms." />
        <div className="dashboard-filters">
          <select className="dashboard-filter-select" value={filters.district} onChange={set('district')} aria-label={t('District')}>
            <option value="">{t('All districts')}</option>
            {districts.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.from} onChange={set('from')} aria-label={t('From')} />
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.to} onChange={set('to')} aria-label={t('To')} />
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}><i className="fas fa-rotate" /> {t('Refresh')}</button>
        </div>
      </div>

      {/* overview */}
      <div className="org-tiles">
        <Tile label="Farmers" value={formatNumber(o.farmers)} onClick={() => goFarmers({})} />
        <Tile label="New this month" value={formatNumber(o.new_this_month)} onClick={() => goFarmers({ joined_from: `${new Date().toISOString().slice(0, 8)}01` })} />
        <Tile
          label="Active farmers"
          value={formatNumber(o.active_farmers)}
          sub={`${total ? Math.round((o.active_farmers / total) * 100) : 0}% · ${t('activity in the last {{days}} days', { days: o.inactive_days })}`}
        />
        <div className="org-tile org-tile-wide"><span className="org-tile-label">{t('Farmer limit')}</span><UsageMeter count={o.usage.count} max={o.usage.max} /></div>
      </div>

      {/* farms and land */}
      <Card title="Farms and land" icon="fa-map-location-dot">
        <div className="org-tiles" style={{ marginBottom: 16 }}>
          <Tile label="Farms" value={formatNumber(d.land.farms)} />
          <Tile label="Fields" value={formatNumber(d.land.fields)} />
          <Tile label="Total area" value={ha(d.land.total_ha)} />
          <Tile label="Average farm size" value={ha(d.land.avg_ha)} />
        </div>
        <div className="org-two">
          <OrgMap points={d.land.points} />
          <div>
            <div className="farm-profile-section">{t('Land by district')}</div>
            {d.land.by_district.length ? (
              <ul className="fp-crops">
                {d.land.by_district.slice(0, 8).map((x) => (
                  <li key={x.district}>
                    <span className="label">{x.district}</span>
                    <span className="muted">{t(x.farmers === 1 ? '{{count}} farmer' : '{{count}} farmers', { count: x.farmers })}</span>
                    <b>{ha(x.ha)}</b>
                  </li>
                ))}
              </ul>
            ) : <p className="org-muted">{t('No farms recorded yet.')}</p>}
          </div>
        </div>
      </Card>

      {/* crops */}
      <Card title="Crops" icon="fa-seedling">
        {d.crops.length ? (
          <>
            <div style={{ height: Math.max(180, cropsBar.length * 34 + 40) }}>
              <Bar
                key={`crops-${dark}`}
                data={{ labels: cropsBar.map((c) => c.name), datasets: [{ data: cropsBar.map((c) => Math.round(c.area_ha * 10) / 10), backgroundColor: LEAF, borderRadius: 4 }] }}
                options={breakdownOptions((v) => `${v} ha`)}
              />
            </div>
            <div className="fp-pipeline" style={{ margin: '16px 0' }}>
              {STAGES.map((st, i) => (
                <div key={st.key} className={`fp-stage ${d.stages[st.key] ? '' : 'empty'}`}>
                  <span className="fp-stage-dot" style={{ background: st.color, color: st.key === 'Ready for Harvest' ? '#1C2B1E' : '#fff' }}>{i + 1}</span>
                  <span className="fp-stage-count">{d.stages[st.key]}</span>
                  <span className="fp-stage-label">{t(st.label)}</span>
                </div>
              ))}
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr><th>{t('Crop')}</th><th>{t('Farmers')}</th><th>{t('Area')}</th><th>{t('Expected harvest')}</th><th>{t('Recorded harvest')}</th></tr>
                </thead>
                <tbody>
                  {d.crops.map((c) => (
                    <tr key={c.name} className="org-row-link" onClick={() => goFarmers({ crop: c.name })}>
                      <td><b>{c.name}</b></td><td>{c.farmers}</td><td>{ha(c.area_ha)}</td><td>{c.expected_kg ? kg(c.expected_kg) : '—'}</td><td>{c.harvested_kg ? kg(c.harvested_kg) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="org-muted">{t('No open crop cycles yet.')}</p>}
      </Card>

      {/* activity */}
      <Card title="Activity" icon="fa-tractor">
        <div className="org-two">
          <div style={{ height: 220 }}>
            <Bar
              key={`act-${dark}`}
              data={{ labels: d.activity.weekly.map((w) => formatDate(w.week)), datasets: [{ label: t('Activities'), data: d.activity.weekly.map((w) => w.count), backgroundColor: LEAF, borderRadius: 4 }] }}
              options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }}
            />
          </div>
          <div>
            <div className="farm-profile-section">{t('Recent activities')}</div>
            {d.activity.recent.length ? (
              <ul className="org-list">
                {d.activity.recent.map((a, i) => (
                  <li key={i}><b>{a.farmer}</b> · {t(a.type || 'Other')} <span className="org-muted">{formatDate(a.date)}</span></li>
                ))}
              </ul>
            ) : <p className="org-muted">{t('No activities recorded yet.')}</p>}
          </div>
        </div>
      </Card>

      {/* alerts */}
      <Card title="Alerts" icon="fa-bell">
        <div className="org-three">
          <div>
            <div className="farm-profile-section">{t('No recent activity')} · {d.alerts.inactive_count}</div>
            <ul className="org-list">
              {d.alerts.inactive.map((a) => (
                <li key={a.farmer_id}><b>{a.farmer}</b> <span className="org-muted">{a.last_activity ? formatDate(a.last_activity) : t('never')}</span></li>
              ))}
            </ul>
            {d.alerts.inactive_count > 0 && <button className="btn btn-outline btn-sm" onClick={() => goFarmers({ inactive: '1' })}>{t('See farmers')}</button>}
          </div>
          <div>
            <div className="farm-profile-section">{t('Pest and disease reports')} · {d.alerts.reports_count}</div>
            <ul className="org-list">
              {d.alerts.reports.map((r, i) => (
                <li key={i}><b>{r.farmer}</b> · {t(r.kind)}{r.crop ? ` · ${r.crop}` : ''}<br /><span className="org-muted">{r.note} · {formatDate(r.date)}</span></li>
              ))}
              {!d.alerts.reports.length && <li className="org-muted">{t('None in the last 14 days')}</li>}
            </ul>
          </div>
          <div>
            <div className="farm-profile-section">{t('Harvest overdue')} · {d.alerts.overdue_count}</div>
            <ul className="org-list">
              {d.alerts.overdue.map((c, i) => (
                <li key={i}><b>{c.farmer}</b> · {c.crop}<br /><span className="org-muted">{t('due {{date}}', { date: formatDate(c.due) })}</span></li>
              ))}
              {!d.alerts.overdue.length && <li className="org-muted">{t('Nothing overdue')}</li>}
            </ul>
          </div>
        </div>
      </Card>
      <p className="org-muted">{t('Figures update every few minutes. Updated {{time}}.', { time: new Date(d.generated_at).toLocaleTimeString() })}</p>
    </>
  );
}

export default function OrgDashboard() {
  return <OrgGate>{({ org }) => <Body org={org} />}</OrgGate>;
}
