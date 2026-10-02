import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { useDashboard } from '../features/dashboard/useDashboard.js';
import { PALETTE, baseOptions, doughnutOptions, chartBg, useIsDark } from '../features/dashboard/charts.jsx';
import { useProfile } from '../components/profile.jsx';
import { Loading, EmptyState, StatTile } from '../components/ui.jsx';
import { formatCurrency, formatNumber, formatDate, getGreeting, displayName, formatTotals, sumByCurrency, currenciesUsed, getCurrency } from '../lib/format.js';
import { FarmProfile } from '../features/dashboard/FarmProfile.jsx';

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
  const [filters, setFilters] = useState({ farm: '', season: '', from: '', to: '', currency: '' });

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

  const name = displayName(profile);

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
      </div>

      {/* Farm profile: land utilization + farm at a glance (same design and order as the mobile app) */}
      <FarmProfile
        farms={d.farms || []}
        fields={d.fields || []}
        selected={filters.farm}
        onSelect={(farm) => setFilters((f) => ({ ...f, farm }))}
        kpis={agg.kpis}
        onKpiClick={(link) => navigate(link)}
        dark={dark}
      />

      {/* filters: 2 x 2 below the farm profile, as in the mobile app */}
      <div className="dashboard-filters-grid">
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
        {agg.currencies.length > 1 && (
          <select
            className="dashboard-filter-select"
            value={filters.currency}
            onChange={(e) => setFilters((f) => ({ ...f, currency: e.target.value }))}
            aria-label="Currency"
          >
            <option value="">All currencies (charts in {agg.chartCurrency})</option>
            {agg.currencies.map((c) => (
              <option key={c} value={c}>Only {c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Crop distribution */}
      <div className="chart-grid">
        <Card title="Crop Distribution" icon="fa-chart-pie" className="full-width" bodyStyle={{ height: 260 }}>
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
          <div className="stat-grid">
            <StatTile label="Total Harvested" value={formatNumber(Math.round(agg.harvest.totalQty))} sub="kg" />
            <StatTile label="Avg Yield" value={agg.harvest.avgYield.toFixed(0)} sub="kg/ha" color="var(--primary)" />
            <StatTile label="Harvest Records" value={agg.harvest.count} sub="records" color="var(--blue)" />
            <StatTile label="Harvest Costs" value={agg.harvest.costText} sub="total" color="var(--red)" />
          </div>
        </Card>
      </div>

      {/* Revenue vs expenses */}
      <div className="chart-card full-width" style={{ marginBottom: 20 }}>
        <div className="chart-card-header">
          <h3><i className="fas fa-chart-area" style={{ color: 'var(--primary)', marginRight: 8 }} />Revenue vs Expenses · {agg.chartCurrency}</h3>
          <div className="wrap-row" style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>
              <i className="fas fa-arrow-up" /> {formatCurrency(agg.finance.totalSales, agg.chartCurrency)} Revenue
            </span>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>
              <i className="fas fa-arrow-down" /> {formatCurrency(agg.finance.totalExpenses, agg.chartCurrency)} Expenses
            </span>
            <span style={{ color: 'var(--blue)', fontWeight: 600 }}>
              Net: {formatCurrency(agg.finance.totalSales - agg.finance.totalExpenses, agg.chartCurrency)}
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
        <Card title={`Expense Breakdown · ${agg.chartCurrency}`} icon="fa-receipt" iconColor="var(--red)" bodyStyle={{ height: 260 }}>
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
        <Card title={`Sales Analytics · ${agg.chartCurrency}`} icon="fa-hand-holding-usd" iconColor="var(--green)">
          <div className="stat-grid" style={{ '--stat-min': '140px' }}>
            <StatTile tone="green" label="Paid" value={formatCurrency(agg.salesByStatus.Paid, agg.chartCurrency)} color="#2E7D32" max={16} />
            <StatTile tone="orange" label="Pending" value={formatCurrency(agg.salesByStatus.Pending, agg.chartCurrency)} color="#F57F17" max={16} />
            <StatTile tone="blue" label="Partial" value={formatCurrency(agg.salesByStatus['Partially Paid'], agg.chartCurrency)} color="#1565C0" max={16} />
          </div>
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <StatTile label="Total Sales" value={formatCurrency(agg.finance.totalSales, agg.chartCurrency)} sub={`${agg.salesInCurrency} records`} max={20} />
          </div>
        </Card>
      </div>

      {/* Inventory health + crop health */}
      <div className="chart-grid">
        <Card title="Inventory Health" icon="fa-boxes" iconColor="var(--blue)">
          {(d.inventory || []).length === 0 ? (
            <NoData label="No inventory items yet" />
          ) : (
            <div className="stat-grid">
              <StatTile label="Healthy Stock" value={agg.inv.healthy} color="#2E7D32" />
              <StatTile label="Low Stock" value={agg.inv.low} color="#F57F17" />
              <StatTile label="Out of Stock" value={agg.inv.out} color="#D32F2F" />
              <StatTile label="Expiring Soon" value={agg.inv.expiring} color="#1565C0" />
            </div>
          )}
        </Card>
        <Card title="Crop Health" icon="fa-heartbeat" iconColor="var(--red)">
          {(d.scouting || []).length === 0 ? (
            <NoData label="No scouting data" />
          ) : (
            <div className="stat-grid" style={{ '--stat-min': '90px' }}>
              <StatTile label="Healthy" value={agg.health.healthy} color="#2E7D32" />
              <StatTile label="Observed" value={agg.health.observed} color="#F57F17" />
              <StatTile label="At Risk" value={agg.health.atRisk} color="#D32F2F" />
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
                  <div className="title">{c.crops?.name || 'Crop'} harvest</div>
                  <div className="meta">{c.farms?.name || ''}{c.fields?.name ? ` / ${c.fields.name}` : ''}</div>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="chart-grid">
        <Card title="Alerts" icon="fa-bell" iconColor="var(--orange)" className="full-width" bodyStyle={{ maxHeight: 320, overflowY: 'auto' }}>
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
      </div>
    </>
  );
}

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
  // money is never converted between currencies: cards show a total per currency
  // (or only the chosen currency); charts show one currency at a time
  const currencies = currenciesUsed(filteredSales, filteredExpenses, filteredHarvests);
  const chartCurrency = filters.currency || currencies[0] || getCurrency();
  const inCurrency = (r) => (r.currency || getCurrency()) === chartCurrency;
  const money = (rows, value) => (filters.currency
    ? formatCurrency(rows.filter(inCurrency).reduce((s, r) => s + (value(r) || 0), 0), chartCurrency)
    : formatTotals(sumByCurrency(rows, value)));
  const chartExpenses = filteredExpenses.filter(inCurrency);
  const chartSales = filteredSales.filter(inCurrency);
  const totalExpenses = chartExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalSales = chartSales.reduce((s, x) => s + (x.total_amount || 0), 0);
  const lowStock = (d.inventory || []).filter((i) => i.current_quantity <= i.minimum_stock).length;

  const kpis = [
    { icon: 'fa-tractor', color: 'green', label: 'Total Farms', value: (d.farms || []).length, link: '/farms' },
    { icon: 'fa-map', color: 'blue', label: 'Total Fields', value: (d.fields || []).length, link: '/fields' },
    { icon: 'fa-sync-alt', color: 'green', label: 'Active Cycles', value: activeCycles.length, link: '/crop-cycles' },
    { icon: 'fa-expand', color: 'blue', label: 'Planted Area', value: `${totalPlanted.toFixed(1)} ha`, link: '/crop-cycles' },
    { icon: 'fa-chart-line', color: 'purple', label: 'Expected Harvest', value: `${formatNumber(Math.round(expectedProd))} kg`, link: '/crop-cycles' },
    { icon: 'fa-wheat-awn', color: 'green', label: 'Harvest Records', value: filteredHarvests.length, link: '/harvest' },
    { icon: 'fa-receipt', color: 'red', label: 'Total Expenses', value: money(filteredExpenses, (e) => e.amount), link: '/expenses' },
    { icon: 'fa-hand-holding-usd', color: 'green', label: 'Total Sales', value: money(filteredSales, (x) => x.total_amount), link: '/sales' },
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
  const harvestCostText = money(filteredHarvests, (h) => (h.labor_cost || 0) + (h.transport_cost || 0) + (h.other_costs || 0));

  // finance by month
  const expByMonth = {};
  chartExpenses.forEach((e) => { const k = e.expense_date?.substring(0, 7); if (k) expByMonth[k] = (expByMonth[k] || 0) + (e.amount || 0); });
  const salByMonth = {};
  chartSales.forEach((s) => { const k = s.sale_date?.substring(0, 7); if (k) salByMonth[k] = (salByMonth[k] || 0) + (s.total_amount || 0); });
  const finKeys = [...new Set([...Object.keys(expByMonth), ...Object.keys(salByMonth)])].sort();

  // expense breakdown
  const catMap = {};
  chartExpenses.forEach((e) => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + (e.amount || 0); });

  // sales by status
  const salesByStatus = { Paid: 0, Pending: 0, 'Partially Paid': 0 };
  chartSales.forEach((s) => { salesByStatus[s.payment_status] = (salesByStatus[s.payment_status] || 0) + (s.total_amount || 0); });

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
    currencies,
    chartCurrency,
    salesInCurrency: chartSales.length,
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
      costText: harvestCostText,
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
