import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { useDashboard } from '../features/dashboard/useDashboard.js';
import { PALETTE, baseOptions, doughnutOptions, chartBg, useIsDark } from '../features/dashboard/charts.jsx';
import { useProfile } from '../components/profile.jsx';
import { Loading, EmptyState } from '../components/ui.jsx';
import { formatCurrency, formatNumber, formatDate, getGreeting } from '../lib/format.js';

const CYCLE_STATUSES = ['Planned', 'Planted', 'Growing', 'Ready for Harvest', 'Harvested', 'Completed', 'Cancelled'];
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(y, m - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};

function Card({ title, icon, iconColor = 'var(--primary)', children, className = '', bodyStyle }) {
  return (
    <div className={`chart-card ${className}`}>
      <div className="chart-card-header">
        <h3>
          <i className={`fas ${icon}`} style={{ color: iconColor, marginRight: 8 }} />
          {title}
        </h3>
      </div>
      <div className="chart-card-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, color = 'var(--text)' }) {
  return (
    <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{sub}</div>}
    </div>
  );
}

const NoData = ({ label = 'No data to display' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120, color: 'var(--text-light)', fontSize: 13 }}>
    {label}
  </div>
);

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const dark = useIsDark();
  const [filters, setFilters] = useState({ farm: '', season: '', from: '', to: '' });

  const d = data || {};
  const agg = useMemo(() => computeAggregates(d, filters), [d, filters]);

  if (isLoading) return <Loading label="Loading dashboard..." />;
  if (isError) {
    return (
      <EmptyState
        icon="fa-exclamation-triangle"
        title="Dashboard Error"
        description="Could not load dashboard data."
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  const name = profile?.full_name || 'Farmer';

  return (
    <>
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">
            {getGreeting()}, {name}
          </h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Here&apos;s what&apos;s happening across your farm today.
          </p>
        </div>
        <div className="dashboard-filters">
          <select className="dashboard-filter-select" value={filters.farm} onChange={(e) => setFilters((f) => ({ ...f, farm: e.target.value }))}>
            <option value="">All Farms</option>
            {(d.farms || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select className="dashboard-filter-select" value={filters.season} onChange={(e) => setFilters((f) => ({ ...f, season: e.target.value }))}>
            <option value="">All Seasons</option>
            {(d.seasons || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {agg.kpis.map((k) => (
          <div key={k.label} className="kpi-card" onClick={() => navigate(k.link)}>
            <div className={`kpi-icon ${k.color}`}>
              <i className={`fas ${k.icon}`} />
            </div>
            <div className="kpi-info">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Land utilization + crop distribution */}
      <div className="chart-grid">
        <Card title="Land Utilization" icon="fa-map-marked-alt" bodyStyle={{ minHeight: 180 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{agg.land.pct}%</div>
            <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 4 }}>Land Utilization Rate</div>
          </div>
          <div className="progress-bar" style={{ height: 12, borderRadius: 6, marginBottom: 16 }}>
            <div className="progress-bar-fill" style={{ width: `${agg.land.pct}%`, borderRadius: 6 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span><b style={{ color: 'var(--primary)' }}>{agg.land.planted.toFixed(1)} ha</b> <span style={{ color: 'var(--text-light)' }}>planted</span></span>
            <span><b style={{ color: 'var(--orange)' }}>{agg.land.fallow.toFixed(1)} ha</b> <span style={{ color: 'var(--text-light)' }}>fallow</span></span>
            <span><b>{agg.land.total.toFixed(1)} ha</b> <span style={{ color: 'var(--text-light)' }}>total</span></span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-light)' }}>
            <div><b style={{ color: 'var(--text)' }}>{(d.farms || []).length}</b> Farms</div>
            <div><b style={{ color: 'var(--text)' }}>{(d.fields || []).length}</b> Fields</div>
            <div><b style={{ color: 'var(--text)' }}>{(d.fields || []).filter((f) => f.status === 'Active').length}</b> Active</div>
          </div>
        </Card>

        <Card title="Crop Distribution" icon="fa-chart-pie" bodyStyle={{ height: 260 }}>
          {agg.cropDist.labels.length ? (
            <Doughnut
              key={`cd-${dark}`}
              data={{
                labels: agg.cropDist.labels,
                datasets: [{ data: agg.cropDist.values, backgroundColor: PALETTE, borderWidth: 2, borderColor: chartBg() }],
              }}
              options={{ ...doughnutOptions(), plugins: { ...doughnutOptions().plugins, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed.toFixed(1)} ha` } } } }}
            />
          ) : (
            <NoData label="No planted crops to display" />
          )}
        </Card>
      </div>

      {/* Cycle status + harvest by crop */}
      <div className="chart-grid">
        <Card title="Cycle Status" icon="fa-sync-alt" bodyStyle={{ height: 260 }}>
          <Doughnut
            key={`cs-${dark}`}
            data={{
              labels: CYCLE_STATUSES,
              datasets: [{
                data: CYCLE_STATUSES.map((s) => agg.cycles.filter((c) => c.status === s).length),
                backgroundColor: ['#1976D2', '#2E7D32', '#66BB6A', '#F9A825', '#FF8F00', '#43A047', '#9E9E9E'],
                borderWidth: 2,
                borderColor: chartBg(),
              }],
            }}
            options={doughnutOptions()}
          />
        </Card>
        <Card title="Harvest by Crop" icon="fa-chart-bar" iconColor="var(--blue)" bodyStyle={{ height: 260 }}>
          {agg.harvestByCrop.labels.length ? (
            <Bar
              key={`hbc-${dark}`}
              data={{
                labels: agg.harvestByCrop.labels,
                datasets: [{ label: 'Quantity (kg)', data: agg.harvestByCrop.values, backgroundColor: PALETTE, borderRadius: 6 }],
              }}
              options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }}
            />
          ) : (
            <NoData label="No harvest data" />
          )}
        </Card>
      </div>

      {/* Production trend */}
      <div className="chart-card full-width" style={{ marginBottom: 20 }}>
        <div className="chart-card-header">
          <h3><i className="fas fa-chart-line" style={{ color: 'var(--primary)', marginRight: 8 }} />Production Trend</h3>
        </div>
        <div className="chart-card-body" style={{ height: 300 }}>
          {agg.trend.labels.length ? (
            <Line
              key={`pt-${dark}`}
              data={{
                labels: agg.trend.labels,
                datasets: [{
                  label: 'Harvest (kg)',
                  data: agg.trend.values,
                  borderColor: '#2E7D32',
                  backgroundColor: 'rgba(46,125,50,0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 4,
                  borderWidth: 3,
                }],
              }}
              options={baseOptions()}
            />
          ) : (
            <NoData label="No harvest data for trend" />
          )}
        </div>
      </div>

      {/* Crop performance + harvest analytics */}
      <div className="chart-grid">
        <Card title="Crop Performance" icon="fa-seedling" bodyStyle={{ height: 260 }}>
          {agg.cropPerf.labels.length ? (
            <Bar
              key={`cp-${dark}`}
              data={{
                labels: agg.cropPerf.labels,
                datasets: [{ label: 'Area (ha)', data: agg.cropPerf.area, backgroundColor: PALETTE, borderRadius: 6 }],
              }}
              options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }}
            />
          ) : (
            <NoData />
          )}
        </Card>
        <Card title="Harvest Analytics" icon="fa-wheat-awn" iconColor="var(--orange)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Tile label="Total Harvested" value={formatNumber(Math.round(agg.harvest.totalQty))} sub="kg" />
            <Tile label="Avg Yield" value={agg.harvest.avgYield.toFixed(0)} sub="kg/ha" color="var(--primary)" />
            <Tile label="Harvest Records" value={agg.harvest.count} sub="records" color="var(--blue)" />
            <Tile label="Harvest Costs" value={formatCurrency(agg.harvest.totalCost)} sub="total" color="var(--red)" />
          </div>
        </Card>
      </div>

      {/* Revenue vs expenses */}
      <div className="chart-card full-width" style={{ marginBottom: 20 }}>
        <div className="chart-card-header">
          <h3><i className="fas fa-chart-area" style={{ color: 'var(--primary)', marginRight: 8 }} />Revenue vs Expenses</h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>
              <i className="fas fa-arrow-up" /> {formatCurrency(agg.finance.totalSales)} Revenue
            </span>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>
              <i className="fas fa-arrow-down" /> {formatCurrency(agg.finance.totalExpenses)} Expenses
            </span>
            <span style={{ color: 'var(--blue)', fontWeight: 600 }}>
              Net: {formatCurrency(agg.finance.totalSales - agg.finance.totalExpenses)}
            </span>
          </div>
        </div>
        <div className="chart-card-body" style={{ height: 280 }}>
          {agg.finance.labels.length ? (
            <Bar
              key={`fin-${dark}`}
              data={{
                labels: agg.finance.labels,
                datasets: [
                  { label: 'Revenue', data: agg.finance.sales, backgroundColor: 'rgba(46,125,50,0.7)', borderRadius: 4, order: 2 },
                  { label: 'Expenses', data: agg.finance.expenses, backgroundColor: 'rgba(211,47,47,0.7)', borderRadius: 4, order: 3 },
                  { label: 'Balance', data: agg.finance.balance, type: 'line', borderColor: '#1976D2', backgroundColor: 'rgba(25,118,210,0.1)', fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2, order: 1 },
                ],
              }}
              options={baseOptions()}
            />
          ) : (
            <NoData label="No financial data yet" />
          )}
        </div>
      </div>

      {/* Expense breakdown + sales analytics */}
      <div className="chart-grid">
        <Card title="Expense Breakdown" icon="fa-receipt" iconColor="var(--red)" bodyStyle={{ height: 260 }}>
          {agg.expenseBreakdown.labels.length ? (
            <Doughnut
              key={`eb-${dark}`}
              data={{
                labels: agg.expenseBreakdown.labels,
                datasets: [{ data: agg.expenseBreakdown.values, backgroundColor: PALETTE, borderWidth: 2, borderColor: chartBg() }],
              }}
              options={doughnutOptions()}
            />
          ) : (
            <NoData label="No expense data" />
          )}
        </Card>
        <Card title="Sales Analytics" icon="fa-hand-holding-usd" iconColor="var(--green)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ textAlign: 'center', padding: '14px 8px', background: '#E8F5E9', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#2E7D32', fontWeight: 700 }}>PAID</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#2E7D32' }}>{formatCurrency(agg.salesByStatus.Paid)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px 8px', background: '#FFF8E1', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#F57F17', fontWeight: 700 }}>PENDING</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F57F17' }}>{formatCurrency(agg.salesByStatus.Pending)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px 8px', background: '#E3F2FD', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#1565C0', fontWeight: 700 }}>PARTIAL</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1565C0' }}>{formatCurrency(agg.salesByStatus['Partially Paid'])}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, textAlign: 'center', padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-light)' }}>Total Sales</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{formatCurrency(agg.finance.totalSales)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{agg.filteredSales.length} records</div>
          </div>
        </Card>
      </div>

      {/* Inventory health + crop health */}
      <div className="chart-grid">
        <Card title="Inventory Health" icon="fa-boxes" iconColor="var(--blue)">
          {(d.inventory || []).length === 0 ? (
            <NoData label="No inventory items yet" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Tile label="Healthy Stock" value={agg.inv.healthy} color="#2E7D32" />
              <Tile label="Low Stock" value={agg.inv.low} color="#F57F17" />
              <Tile label="Out of Stock" value={agg.inv.out} color="#D32F2F" />
              <Tile label="Expiring Soon" value={agg.inv.expiring} color="#1565C0" />
            </div>
          )}
        </Card>
        <Card title="Crop Health" icon="fa-heartbeat" iconColor="var(--red)">
          {(d.scouting || []).length === 0 ? (
            <NoData label="No scouting data" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Tile label="Healthy" value={agg.health.healthy} color="#2E7D32" />
              <Tile label="Observed" value={agg.health.observed} color="#F57F17" />
              <Tile label="At Risk" value={agg.health.atRisk} color="#D32F2F" />
            </div>
          )}
        </Card>
      </div>

      {/* Recent activities + upcoming events + alerts */}
      <div className="chart-grid">
        <Card title="Recent Activities" icon="fa-clock" iconColor="var(--purple)" bodyStyle={{ maxHeight: 320, overflowY: 'auto' }}>
          {(d.activities || []).length === 0 ? (
            <NoData label="No recent activities" />
          ) : (
            <div className="activity-timeline">
              {(d.activities || []).slice(0, 8).map((a) => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-text">
                    <strong>{a.activity_type}</strong> — {a.description || 'No description'}
                  </div>
                  <div className="activity-meta">
                    {a.farms?.name || ''} {a.fields?.name ? `/ ${a.fields.name}` : ''} · {formatDate(a.activity_date)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Upcoming Events" icon="fa-calendar-check" iconColor="var(--blue)" bodyStyle={{ maxHeight: 320, overflowY: 'auto' }}>
          {agg.upcoming.length === 0 ? (
            <NoData label="No upcoming events" />
          ) : (
            agg.upcoming.map((c) => (
              <div key={c.id} className="upcoming-event">
                <div className="upcoming-date">
                  <span className="day">{new Date(c.expected_harvest_date).getDate()}</span>
                  <span className="month">{new Date(c.expected_harvest_date).toLocaleString('en', { month: 'short' })}</span>
                </div>
                <div className="upcoming-info">
                  <div className="title">Expected Harvest — {c.crops?.name || ''}</div>
                  <div className="meta">{c.farms?.name || ''} / {c.fields?.name || ''}</div>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="chart-grid">
        <Card title="Alerts" icon="fa-bell" iconColor="var(--orange)" bodyStyle={{ maxHeight: 320, overflowY: 'auto' }}>
          {agg.alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)', fontSize: 13 }}>
              <i className="fas fa-check-circle" style={{ fontSize: 24, color: 'var(--primary)', display: 'block', marginBottom: 8 }} />
              All clear — no alerts
            </div>
          ) : (
            agg.alerts.map((a, i) => (
              <div key={i} className={`alert-item alert-${a.type}`}>
                <i className={`fas ${a.icon}`} />
                <div className="alert-content">
                  <strong>{a.title}</strong>
                  {a.msg}
                </div>
              </div>
            ))
          )}
        </Card>
        <Card title="Quick Actions" icon="fa-bolt" iconColor="var(--purple)">
          <div className="quick-actions-grid">
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} className="quick-action-btn" onClick={() => navigate(a.link)}>
                <i className={`fas ${a.icon}`} /> {a.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

const QUICK_ACTIONS = [
  { icon: 'fa-tractor', label: 'Add Farm', link: '/farms' },
  { icon: 'fa-map', label: 'Add Field', link: '/fields' },
  { icon: 'fa-sync-alt', label: 'Start Cycle', link: '/crop-cycles' },
  { icon: 'fa-seedling', label: 'Record Planting', link: '/planting' },
  { icon: 'fa-tasks', label: 'Record Activity', link: '/activities' },
  { icon: 'fa-tint', label: 'Record Irrigation', link: '/irrigation' },
  { icon: 'fa-flask', label: 'Record Fertilizer', link: '/fertilizers' },
  { icon: 'fa-search', label: 'Record Scouting', link: '/scouting' },
  { icon: 'fa-wheat-awn', label: 'Record Harvest', link: '/harvest' },
  { icon: 'fa-receipt', label: 'Add Expense', link: '/expenses' },
  { icon: 'fa-hand-holding-usd', label: 'Record Sale', link: '/sales' },
  { icon: 'fa-calculator', label: 'Calculators', link: '/calculators' },
];

function computeAggregates(d, filters) {
  const inRange = (date) => {
    if (!date) return true;
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;
    return true;
  };

  const cycles = (d.cycles || []).filter((c) => {
    if (filters.farm && c.farm_id !== filters.farm) return false;
    if (filters.season && c.season_id !== filters.season) return false;
    if (!inRange(c.planting_date)) return false;
    return true;
  });
  const filteredHarvests = (d.harvests || []).filter((h) => (!filters.farm || h.farm_id === filters.farm) && inRange(h.harvest_date));
  const filteredExpenses = (d.expenses || []).filter((e) => (!filters.farm || e.farm_id === filters.farm) && inRange(e.expense_date));
  const filteredSales = (d.sales || []).filter((s) => (!filters.farm || s.farm_id === filters.farm) && inRange(s.sale_date));

  const activeCycles = cycles.filter((c) => ['Planted', 'Growing', 'Ready for Harvest'].includes(c.status));
  const totalPlanted = cycles.filter((c) => !['Planned', 'Cancelled'].includes(c.status)).reduce((s, c) => s + (c.area_planted || 0), 0);
  const expectedProd = cycles.reduce((s, c) => s + (c.expected_production || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalSales = filteredSales.reduce((s, x) => s + (x.total_amount || 0), 0);
  const lowStock = (d.inventory || []).filter((i) => i.current_quantity <= i.minimum_stock).length;

  const kpis = [
    { icon: 'fa-tractor', color: 'green', label: 'Total Farms', value: (d.farms || []).length, link: '/farms' },
    { icon: 'fa-map', color: 'blue', label: 'Total Fields', value: (d.fields || []).length, link: '/fields' },
    { icon: 'fa-sync-alt', color: 'green', label: 'Active Cycles', value: activeCycles.length, link: '/crop-cycles' },
    { icon: 'fa-expand', color: 'blue', label: 'Planted Area', value: `${totalPlanted.toFixed(1)} ha`, link: '/crop-cycles' },
    { icon: 'fa-chart-line', color: 'purple', label: 'Expected Harvest', value: `${formatNumber(Math.round(expectedProd))} kg`, link: '/crop-cycles' },
    { icon: 'fa-wheat-awn', color: 'green', label: 'Harvest Records', value: filteredHarvests.length, link: '/harvest' },
    { icon: 'fa-receipt', color: 'red', label: 'Total Expenses', value: formatCurrency(totalExpenses), link: '/expenses' },
    { icon: 'fa-hand-holding-usd', color: 'green', label: 'Total Sales', value: formatCurrency(totalSales), link: '/sales' },
    { icon: 'fa-boxes', color: 'blue', label: 'Inventory Items', value: (d.inventory || []).length, link: '/inventory' },
    { icon: 'fa-exclamation-triangle', color: lowStock > 0 ? 'red' : 'green', label: 'Low Stock Items', value: lowStock, link: '/inventory' },
  ];

  // land
  const totalArea = (d.farms || []).reduce((s, f) => s + (f.total_area || 0), 0);
  const plantedArea = (d.fields || []).filter((f) => f.status === 'Active').reduce((s, f) => s + (f.area || 0), 0);
  const fallowArea = (d.fields || []).filter((f) => f.status === 'Fallow').reduce((s, f) => s + (f.area || 0), 0);

  // crop distribution
  const cropMap = {};
  cycles.filter((c) => !['Planned', 'Cancelled'].includes(c.status)).forEach((c) => {
    const n = c.crops?.name || 'Unknown';
    cropMap[n] = (cropMap[n] || 0) + (c.area_planted || 0);
  });

  // harvest by crop
  const hCropMap = {};
  filteredHarvests.forEach((h) => {
    const n = h.crops?.name || 'Unknown';
    hCropMap[n] = (hCropMap[n] || 0) + (h.quantity || 0);
  });

  // production trend
  const monthMap = {};
  filteredHarvests.forEach((h) => {
    if (!h.harvest_date) return;
    const key = h.harvest_date.substring(0, 7);
    monthMap[key] = (monthMap[key] || 0) + (h.quantity || 0);
  });
  const trendKeys = Object.keys(monthMap).sort();

  // crop performance
  const perfMap = {};
  cycles.forEach((c) => {
    const n = c.crops?.name || 'Unknown';
    perfMap[n] = (perfMap[n] || 0) + (c.area_planted || 0);
  });

  // harvest analytics
  const totalQty = filteredHarvests.reduce((s, h) => s + (h.quantity || 0), 0);
  const totalArea2 = filteredHarvests.reduce((s, h) => s + (h.harvested_area || 0), 0);
  const totalHarvestCost = filteredHarvests.reduce((s, h) => s + (h.labor_cost || 0) + (h.transport_cost || 0) + (h.other_costs || 0), 0);

  // finance by month
  const expByMonth = {};
  filteredExpenses.forEach((e) => { const k = e.expense_date?.substring(0, 7); if (k) expByMonth[k] = (expByMonth[k] || 0) + (e.amount || 0); });
  const salByMonth = {};
  filteredSales.forEach((s) => { const k = s.sale_date?.substring(0, 7); if (k) salByMonth[k] = (salByMonth[k] || 0) + (s.total_amount || 0); });
  const finKeys = [...new Set([...Object.keys(expByMonth), ...Object.keys(salByMonth)])].sort();

  // expense breakdown
  const catMap = {};
  filteredExpenses.forEach((e) => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + (e.amount || 0); });

  // sales by status
  const salesByStatus = { Paid: 0, Pending: 0, 'Partially Paid': 0 };
  filteredSales.forEach((s) => { salesByStatus[s.payment_status] = (salesByStatus[s.payment_status] || 0) + (s.total_amount || 0); });

  // inventory health
  const inv = d.inventory || [];
  const now = Date.now();
  const invHealth = {
    healthy: inv.filter((i) => i.current_quantity > i.minimum_stock * 1.5).length,
    low: inv.filter((i) => i.current_quantity > 0 && i.current_quantity <= i.minimum_stock * 1.5).length,
    out: inv.filter((i) => i.current_quantity <= 0).length,
    expiring: inv.filter((i) => i.expiry_date && new Date(i.expiry_date) <= new Date(now + 30 * 86400000) && new Date(i.expiry_date) >= new Date(now)).length,
  };

  // crop health
  const scouting = d.scouting || [];
  const health = {
    healthy: scouting.filter((s) => s.plant_health === 'Healthy').length,
    observed: scouting.filter((s) => s.plant_health === 'Under Observation').length,
    atRisk: scouting.filter((s) => s.plant_health === 'At Risk').length,
  };

  // upcoming
  const upcoming = (d.cycles || [])
    .filter((c) => ['Planned', 'Planted', 'Growing', 'Ready for Harvest'].includes(c.status) && c.expected_harvest_date && new Date(c.expected_harvest_date) >= new Date())
    .sort((a, b) => new Date(a.expected_harvest_date) - new Date(b.expected_harvest_date))
    .slice(0, 5);

  // alerts
  const alerts = [];
  inv.filter((i) => i.current_quantity <= i.minimum_stock && i.current_quantity > 0).forEach((i) =>
    alerts.push({ type: 'warning', icon: 'fa-boxes', title: 'LOW STOCK ', msg: `${i.name} is below minimum stock level.` }));
  inv.filter((i) => i.current_quantity <= 0).forEach((i) =>
    alerts.push({ type: 'danger', icon: 'fa-boxes', title: 'OUT OF STOCK ', msg: `${i.name} has zero stock.` }));
  (d.cycles || []).filter((c) => c.status === 'Ready for Harvest').forEach((c) =>
    alerts.push({ type: 'info', icon: 'fa-wheat-awn', title: 'HARVEST READY ', msg: `${c.crops?.name || ''} is ready for harvest.` }));
  scouting.filter((s) => s.plant_health === 'At Risk').slice(-3).forEach((s) =>
    alerts.push({ type: 'danger', icon: 'fa-exclamation-triangle', title: 'CROP HEALTH ', msg: `At-risk observation on ${s.crops?.name || ''} at ${s.farms?.name || ''}.` }));

  return {
    kpis,
    cycles,
    filteredSales,
    land: {
      planted: plantedArea,
      fallow: fallowArea,
      total: totalArea,
      pct: totalArea > 0 ? Math.round((plantedArea / totalArea) * 100) : 0,
    },
    cropDist: { labels: Object.keys(cropMap), values: Object.values(cropMap) },
    harvestByCrop: { labels: Object.keys(hCropMap), values: Object.values(hCropMap) },
    trend: { labels: trendKeys.map(monthLabel), values: trendKeys.map((k) => monthMap[k]) },
    cropPerf: { labels: Object.keys(perfMap), area: Object.values(perfMap) },
    harvest: {
      totalQty,
      avgYield: totalArea2 > 0 ? totalQty / totalArea2 : 0,
      count: filteredHarvests.length,
      totalCost: totalHarvestCost,
    },
    finance: {
      labels: finKeys.map(monthLabel),
      sales: finKeys.map((k) => salByMonth[k] || 0),
      expenses: finKeys.map((k) => expByMonth[k] || 0),
      balance: finKeys.map((k) => (salByMonth[k] || 0) - (expByMonth[k] || 0)),
      totalSales,
      totalExpenses,
    },
    expenseBreakdown: { labels: Object.keys(catMap), values: Object.values(catMap) },
    salesByStatus,
    inv: invHealth,
    health,
    upcoming,
    alerts,
  };
}
