import { useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useDashboard } from '../features/dashboard/useDashboard.js';
import { PALETTE, baseOptions, doughnutOptions, chartBg, useIsDark } from '../features/dashboard/charts.jsx';
import { useProfile } from '../components/profile.jsx';
import { useToast } from '../components/Toast.jsx';
import { Loading, EmptyState } from '../components/ui.jsx';
import { formatCurrency, formatNumber, formatDate } from '../lib/format.js';

const REPORTS = [
  { id: 'production', label: 'Production', icon: 'fa-wheat-awn' },
  { id: 'yield', label: 'Yield', icon: 'fa-balance-scale' },
  { id: 'financial', label: 'Financial', icon: 'fa-coins' },
  { id: 'cycles', label: 'Crop Cycles', icon: 'fa-sync-alt' },
];

const CYCLE_STATUSES = ['Planned', 'Planted', 'Growing', 'Ready for Harvest', 'Harvested', 'Completed', 'Cancelled'];
const STATUS_COLORS = ['#1976D2', '#2E7D32', '#66BB6A', '#F9A825', '#FF8F00', '#43A047', '#9E9E9E'];

const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(y, m - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};
const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/* ---- CSV export ---------------------------------------------------------- */
function downloadCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ---- small presentational bits ---------------------------------------- */
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

function ReportCard({ title, icon, iconColor = 'var(--primary)', right, children, bodyStyle }) {
  return (
    <div className="chart-card full-width" style={{ marginBottom: 20 }}>
      <div className="chart-card-header">
        <h3>
          <i className={`fas ${icon}`} style={{ color: iconColor, marginRight: 8 }} />
          {title}
        </h3>
        {right}
      </div>
      <div className="chart-card-body" style={bodyStyle}>{children}</div>
    </div>
  );
}

function ReportTable({ columns, rows }) {
  if (!rows.length) {
    return <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)', fontSize: 13 }}>No data for the selected filters</div>;
  }
  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._key ?? i} style={row._total ? { fontWeight: 700, background: 'var(--bg)' } : undefined}>
              {columns.map((c) => (
                <td key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- filtering ------------------------------------------------------------ */
function useFilteredData(d, filters) {
  return useMemo(() => {
    const cycleSeason = {};
    (d.cycles || []).forEach((c) => { cycleSeason[c.id] = c.season_id || null; });

    const inRange = (date) => {
      if (!date) return !filters.from && !filters.to;
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      return true;
    };
    const seasonOk = (rec, ownSeason) => {
      if (!filters.season) return true;
      const s = ownSeason !== undefined ? ownSeason : cycleSeason[rec.crop_cycle_id];
      return s === filters.season;
    };
    const farmOk = (rec) => !filters.farm || rec.farm_id === filters.farm;

    const cycles = (d.cycles || []).filter(
      (c) => farmOk(c) && seasonOk(c, c.season_id || null) && (filters.from || filters.to ? inRange(c.planting_date) : true),
    );
    const harvests = (d.harvests || []).filter((h) => farmOk(h) && seasonOk(h) && inRange(h.harvest_date));
    const expenses = (d.expenses || []).filter((e) => farmOk(e) && seasonOk(e) && inRange(e.expense_date));
    const sales = (d.sales || []).filter((s) => farmOk(s) && seasonOk(s) && inRange(s.sale_date));

    return { cycles, harvests, expenses, sales };
  }, [d, filters]);
}

/* ---- report builders --------------------------------------------------- */
function buildProduction({ cycles, harvests }, dark) {
  const map = {};
  const get = (name) => (map[name] ||= { crop: name, cycles: 0, area: 0, expected: 0, harvested: 0 });
  cycles.forEach((c) => {
    const r = get(c.crops?.name || 'Unknown');
    r.cycles += 1;
    if (!['Planned', 'Cancelled'].includes(c.status)) r.area += num(c.area_planted);
    r.expected += num(c.expected_production);
  });
  harvests.forEach((h) => {
    get(h.crops?.name || h.crop_cycles?.crops?.name || 'Unknown').harvested += num(h.quantity);
  });

  const rows = Object.values(map)
    .map((r) => ({
      ...r,
      yield: r.area > 0 ? r.harvested / r.area : 0,
      achievement: r.expected > 0 ? (r.harvested / r.expected) * 100 : 0,
    }))
    .sort((a, b) => b.harvested - a.harvested);

  const tot = rows.reduce(
    (s, r) => ({ cycles: s.cycles + r.cycles, area: s.area + r.area, expected: s.expected + r.expected, harvested: s.harvested + r.harvested }),
    { cycles: 0, area: 0, expected: 0, harvested: 0 },
  );

  const columns = [
    { key: 'crop', label: 'Crop' },
    { key: 'cycles', label: 'Cycles', align: 'right' },
    { key: 'area', label: 'Area (ha)', align: 'right', render: (r) => round1(r.area).toLocaleString() },
    { key: 'expected', label: 'Expected (kg)', align: 'right', render: (r) => formatNumber(Math.round(r.expected)) },
    { key: 'harvested', label: 'Harvested (kg)', align: 'right', render: (r) => formatNumber(Math.round(r.harvested)) },
    { key: 'yield', label: 'Yield (kg/ha)', align: 'right', render: (r) => (r.yield ? formatNumber(Math.round(r.yield)) : '—') },
    { key: 'achievement', label: 'Achievement', align: 'right', render: (r) => (r.expected ? `${Math.round(r.achievement)}%` : '—') },
  ];

  const tableRows = [
    ...rows.map((r) => ({ ...r, _key: r.crop })),
    rows.length > 1 && {
      _key: '__total', _total: true, crop: 'All crops', cycles: tot.cycles, area: tot.area,
      expected: tot.expected, harvested: tot.harvested,
      yield: tot.area > 0 ? tot.harvested / tot.area : 0,
      achievement: tot.expected > 0 ? (tot.harvested / tot.expected) * 100 : 0,
    },
  ].filter(Boolean);

  const chart = rows.length ? (
    <div style={{ height: 300 }}>
      <Bar
        key={`prod-${dark}`}
        data={{
          labels: rows.map((r) => r.crop),
          datasets: [
            { label: 'Expected (kg)', data: rows.map((r) => Math.round(r.expected)), backgroundColor: 'rgba(25,118,210,0.55)', borderRadius: 6 },
            { label: 'Harvested (kg)', data: rows.map((r) => Math.round(r.harvested)), backgroundColor: 'rgba(46,125,50,0.75)', borderRadius: 6 },
          ],
        }}
        options={baseOptions()}
      />
    </div>
  ) : null;

  return {
    empty: rows.length === 0,
    tiles: [
      { label: 'Crop Cycles', value: formatNumber(tot.cycles) },
      { label: 'Planted Area', value: round1(tot.area).toLocaleString(), sub: 'ha', color: 'var(--blue)' },
      { label: 'Expected', value: formatNumber(Math.round(tot.expected)), sub: 'kg', color: 'var(--purple)' },
      { label: 'Harvested', value: formatNumber(Math.round(tot.harvested)), sub: 'kg', color: 'var(--primary)' },
      { label: 'Achievement', value: tot.expected ? `${Math.round((tot.harvested / tot.expected) * 100)}%` : '—', color: 'var(--orange)' },
    ],
    chart,
    columns,
    tableRows,
    csv: {
      headers: ['Crop', 'Cycles', 'Area (ha)', 'Expected (kg)', 'Harvested (kg)', 'Yield (kg/ha)', 'Achievement (%)'],
      rows: rows.map((r) => [r.crop, r.cycles, round1(r.area), Math.round(r.expected), Math.round(r.harvested), Math.round(r.yield), Math.round(r.achievement)]),
    },
  };
}

function buildYield({ harvests }, dark) {
  const map = {};
  const get = (name) => (map[name] ||= { crop: name, records: 0, area: 0, qty: 0 });
  harvests.forEach((h) => {
    const r = get(h.crops?.name || h.crop_cycles?.crops?.name || 'Unknown');
    r.records += 1;
    r.area += num(h.harvested_area);
    r.qty += num(h.quantity);
  });
  const rows = Object.values(map)
    .map((r) => ({ ...r, yield: r.area > 0 ? r.qty / r.area : 0 }))
    .sort((a, b) => b.yield - a.yield);

  const totQty = rows.reduce((s, r) => s + r.qty, 0);
  const totArea = rows.reduce((s, r) => s + r.area, 0);

  // monthly trend
  const monthMap = {};
  harvests.forEach((h) => {
    if (!h.harvest_date) return;
    const k = h.harvest_date.substring(0, 7);
    monthMap[k] = (monthMap[k] || 0) + num(h.quantity);
  });
  const mKeys = Object.keys(monthMap).sort();

  const columns = [
    { key: 'crop', label: 'Crop' },
    { key: 'records', label: 'Records', align: 'right' },
    { key: 'area', label: 'Harvested Area (ha)', align: 'right', render: (r) => (r.area ? round1(r.area).toLocaleString() : '—') },
    { key: 'qty', label: 'Quantity (kg)', align: 'right', render: (r) => formatNumber(Math.round(r.qty)) },
    { key: 'yield', label: 'Avg Yield (kg/ha)', align: 'right', render: (r) => (r.yield ? formatNumber(Math.round(r.yield)) : '—') },
  ];
  const tableRows = [
    ...rows.map((r) => ({ ...r, _key: r.crop })),
    rows.length > 1 && {
      _key: '__total', _total: true, crop: 'All crops', records: rows.reduce((s, r) => s + r.records, 0),
      area: totArea, qty: totQty, yield: totArea > 0 ? totQty / totArea : 0,
    },
  ].filter(Boolean);

  const chart = (
    <div className="chart-grid" style={{ marginTop: 4 }}>
      <div style={{ height: 280 }}>
        {rows.length ? (
          <Bar
            key={`yc-${dark}`}
            data={{ labels: rows.map((r) => r.crop), datasets: [{ label: 'Yield (kg/ha)', data: rows.map((r) => Math.round(r.yield)), backgroundColor: PALETTE, borderRadius: 6 }] }}
            options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }}
          />
        ) : null}
      </div>
      <div style={{ height: 280 }}>
        {mKeys.length ? (
          <Line
            key={`yt-${dark}`}
            data={{
              labels: mKeys.map(monthLabel),
              datasets: [{ label: 'Harvest (kg)', data: mKeys.map((k) => Math.round(monthMap[k])), borderColor: '#2E7D32', backgroundColor: 'rgba(46,125,50,0.1)', fill: true, tension: 0.4, pointRadius: 4, borderWidth: 3 }],
            }}
            options={baseOptions()}
          />
        ) : null}
      </div>
    </div>
  );

  return {
    empty: rows.length === 0,
    tiles: [
      { label: 'Total Harvested', value: formatNumber(Math.round(totQty)), sub: 'kg', color: 'var(--primary)' },
      { label: 'Harvested Area', value: round1(totArea).toLocaleString(), sub: 'ha', color: 'var(--blue)' },
      { label: 'Overall Yield', value: totArea ? formatNumber(Math.round(totQty / totArea)) : '—', sub: 'kg/ha', color: 'var(--orange)' },
      { label: 'Harvest Records', value: formatNumber(harvests.length) },
    ],
    chart,
    columns,
    tableRows,
    csv: {
      headers: ['Crop', 'Records', 'Harvested Area (ha)', 'Quantity (kg)', 'Avg Yield (kg/ha)'],
      rows: rows.map((r) => [r.crop, r.records, round1(r.area), Math.round(r.qty), Math.round(r.yield)]),
    },
  };
}

function buildFinancial({ expenses, sales }, dark) {
  const byMonth = {};
  const m = (k) => (byMonth[k] ||= { month: k, revenue: 0, expenses: 0 });
  sales.forEach((s) => { if (s.sale_date) m(s.sale_date.substring(0, 7)).revenue += num(s.total_amount); });
  expenses.forEach((e) => { if (e.expense_date) m(e.expense_date.substring(0, 7)).expenses += num(e.amount); });
  const months = Object.values(byMonth)
    .map((r) => ({ ...r, net: r.revenue - r.expenses, margin: r.revenue > 0 ? ((r.revenue - r.expenses) / r.revenue) * 100 : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const totRev = sales.reduce((s, x) => s + num(x.total_amount), 0);
  const totExp = expenses.reduce((s, x) => s + num(x.amount), 0);
  const net = totRev - totExp;

  // expense breakdown
  const catMap = {};
  expenses.forEach((e) => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + num(e.amount); });
  const cats = Object.entries(catMap).map(([k, v]) => ({ category: k, amount: v })).sort((a, b) => b.amount - a.amount);

  const columns = [
    { key: 'month', label: 'Month', render: (r) => monthLabel(r.month) },
    { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => formatCurrency(r.revenue) },
    { key: 'expenses', label: 'Expenses', align: 'right', render: (r) => formatCurrency(r.expenses) },
    { key: 'net', label: 'Net', align: 'right', render: (r) => <span style={{ color: r.net >= 0 ? '#2E7D32' : '#D32F2F' }}>{formatCurrency(r.net)}</span> },
    { key: 'margin', label: 'Margin', align: 'right', render: (r) => (r.revenue ? `${Math.round(r.margin)}%` : '—') },
  ];
  const tableRows = [
    ...months.map((r) => ({ ...r, _key: r.month })),
    months.length > 0 && {
      _key: '__total', _total: true, month: '__', revenue: totRev, expenses: totExp, net,
      margin: totRev ? (net / totRev) * 100 : 0, _label: 'Total',
    },
  ].filter(Boolean);
  // override month render for total row
  columns[0].render = (r) => (r._total ? 'Total' : monthLabel(r.month));

  const chart = (
    <div className="chart-grid" style={{ marginTop: 4 }}>
      <div style={{ height: 300 }}>
        {months.length ? (
          <Bar
            key={`fin-${dark}`}
            data={{
              labels: months.map((r) => monthLabel(r.month)),
              datasets: [
                { label: 'Revenue', data: months.map((r) => Math.round(r.revenue)), backgroundColor: 'rgba(46,125,50,0.7)', borderRadius: 4, order: 2 },
                { label: 'Expenses', data: months.map((r) => Math.round(r.expenses)), backgroundColor: 'rgba(211,47,47,0.7)', borderRadius: 4, order: 3 },
                { label: 'Net', data: months.map((r) => Math.round(r.net)), type: 'line', borderColor: '#1976D2', backgroundColor: 'rgba(25,118,210,0.1)', fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2, order: 1 },
              ],
            }}
            options={baseOptions()}
          />
        ) : null}
      </div>
      <div style={{ height: 300 }}>
        {cats.length ? (
          <Doughnut
            key={`finc-${dark}`}
            data={{ labels: cats.map((c) => c.category), datasets: [{ data: cats.map((c) => Math.round(c.amount)), backgroundColor: PALETTE, borderWidth: 2, borderColor: chartBg() }] }}
            options={doughnutOptions()}
          />
        ) : null}
      </div>
    </div>
  );

  return {
    empty: months.length === 0,
    tiles: [
      { label: 'Total Revenue', value: formatCurrency(totRev), color: '#2E7D32' },
      { label: 'Total Expenses', value: formatCurrency(totExp), color: '#D32F2F' },
      { label: 'Net Profit', value: formatCurrency(net), color: net >= 0 ? '#2E7D32' : '#D32F2F' },
      { label: 'Profit Margin', value: totRev ? `${Math.round((net / totRev) * 100)}%` : '—', color: 'var(--blue)' },
    ],
    chart,
    columns,
    tableRows,
    extra:
      cats.length > 0 ? (
        <ReportCard title="Expense Breakdown" icon="fa-receipt" iconColor="var(--red)">
          <ReportTable
            columns={[
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
              { key: 'share', label: 'Share', align: 'right', render: (r) => `${Math.round((r.amount / totExp) * 100)}%` },
            ]}
            rows={cats.map((c) => ({ ...c, _key: c.category }))}
          />
        </ReportCard>
      ) : null,
    csv: {
      headers: ['Month', 'Revenue', 'Expenses', 'Net', 'Margin (%)'],
      rows: months.map((r) => [r.month, round1(r.revenue), round1(r.expenses), round1(r.net), Math.round(r.margin)]),
    },
  };
}

function buildCycles({ cycles }, dark) {
  const rows = [...cycles].sort((a, b) => (b.planting_date || '').localeCompare(a.planting_date || ''));
  const statusCounts = CYCLE_STATUSES.map((s) => cycles.filter((c) => c.status === s).length);
  const active = cycles.filter((c) => ['Planted', 'Growing', 'Ready for Harvest'].includes(c.status)).length;
  const completed = cycles.filter((c) => ['Harvested', 'Completed'].includes(c.status)).length;
  const area = cycles.filter((c) => !['Planned', 'Cancelled'].includes(c.status)).reduce((s, c) => s + num(c.area_planted), 0);

  const columns = [
    { key: 'crop', label: 'Crop', render: (r) => r.crops?.name || '—' },
    { key: 'farm', label: 'Farm', render: (r) => r.farms?.name || '—' },
    { key: 'field', label: 'Field', render: (r) => r.fields?.name || '—' },
    { key: 'season', label: 'Season', render: (r) => r.seasons?.name || '—' },
    { key: 'status', label: 'Status', render: (r) => <span className="badge badge-neutral">{r.status || '—'}</span> },
    { key: 'planting_date', label: 'Planted', render: (r) => formatDate(r.planting_date) },
    { key: 'expected_harvest_date', label: 'Exp. Harvest', render: (r) => formatDate(r.expected_harvest_date) },
    { key: 'area_planted', label: 'Area (ha)', align: 'right', render: (r) => (r.area_planted ? round1(r.area_planted).toLocaleString() : '—') },
    { key: 'expected_production', label: 'Expected (kg)', align: 'right', render: (r) => (r.expected_production ? formatNumber(Math.round(r.expected_production)) : '—') },
    { key: 'actual_production', label: 'Actual (kg)', align: 'right', render: (r) => (r.actual_production ? formatNumber(Math.round(r.actual_production)) : '—') },
  ];

  const chart = cycles.length ? (
    <div style={{ height: 280 }}>
      <Doughnut
        key={`cyc-${dark}`}
        data={{ labels: CYCLE_STATUSES, datasets: [{ data: statusCounts, backgroundColor: STATUS_COLORS, borderWidth: 2, borderColor: chartBg() }] }}
        options={doughnutOptions()}
      />
    </div>
  ) : null;

  return {
    empty: cycles.length === 0,
    tiles: [
      { label: 'Total Cycles', value: formatNumber(cycles.length) },
      { label: 'Active', value: formatNumber(active), color: 'var(--primary)' },
      { label: 'Completed', value: formatNumber(completed), color: 'var(--blue)' },
      { label: 'Planted Area', value: round1(area).toLocaleString(), sub: 'ha', color: 'var(--orange)' },
    ],
    chart,
    columns,
    tableRows: rows.map((r) => ({ ...r, _key: r.id })),
    csv: {
      headers: ['Crop', 'Farm', 'Field', 'Season', 'Status', 'Planted', 'Expected Harvest', 'Area (ha)', 'Expected (kg)', 'Actual (kg)'],
      rows: rows.map((r) => [
        r.crops?.name || '', r.farms?.name || '', r.fields?.name || '', r.seasons?.name || '', r.status || '',
        r.planting_date || '', r.expected_harvest_date || '', num(r.area_planted), Math.round(num(r.expected_production)), Math.round(num(r.actual_production)),
      ]),
    },
  };
}

const BUILDERS = { production: buildProduction, yield: buildYield, financial: buildFinancial, cycles: buildCycles };

/* ---- page ------------------------------------------------------------- */
export default function Reports() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const { profile } = useProfile();
  const toast = useToast();
  const dark = useIsDark();
  const [active, setActive] = useState('production');
  const [filters, setFilters] = useState({ farm: '', season: '', from: '', to: '' });

  const d = data || {};
  const filtered = useFilteredData(d, filters);
  const report = useMemo(() => BUILDERS[active](filtered, dark), [active, filtered, dark]);

  if (isLoading) return <Loading label="Loading report data..." />;
  if (isError) {
    return (
      <EmptyState
        icon="fa-exclamation-triangle"
        title="Could not load reports"
        description="There was a problem fetching your data."
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  const meta = REPORTS.find((r) => r.id === active);
  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const filterLabel = () => {
    const parts = [];
    if (filters.farm) parts.push((d.farms || []).find((x) => x.id === filters.farm)?.name);
    if (filters.season) parts.push((d.seasons || []).find((x) => x.id === filters.season)?.name);
    if (filters.from || filters.to) parts.push(`${filters.from || '…'} → ${filters.to || '…'}`);
    return parts.filter(Boolean).join(' · ') || 'All farms · all time';
  };

  const exportCSV = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`${active}-report-${stamp}.csv`, report.csv.headers, report.csv.rows);
    toast('Report exported as CSV', 'info');
  };

  return (
    <>
      <div className="dashboard-header no-print">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>Production, yield and financial reporting.</p>
        </div>
        <div className="dashboard-filters">
          <select className="dashboard-filter-select" value={filters.farm} onChange={setF('farm')}>
            <option value="">All Farms</option>
            {(d.farms || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="dashboard-filter-select" value={filters.season} onChange={setF('season')}>
            <option value="">All Seasons</option>
            {(d.seasons || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.from} onChange={setF('from')} />
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.to} onChange={setF('to')} />
        </div>
      </div>

      <div className="report-tabs no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {REPORTS.map((r) => (
          <button
            key={r.id}
            className={`btn btn-sm ${active === r.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActive(r.id)}
          >
            <i className={`fas ${r.icon}`} /> {r.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm btn-secondary" onClick={exportCSV} disabled={report.empty}>
          <i className="fas fa-file-csv" /> Export CSV
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => window.print()}>
          <i className="fas fa-print" /> Print
        </button>
      </div>

      <div className="print-only" style={{ marginBottom: 12 }}>
        <h1 className="page-title">{meta.label} Report</h1>
        <p className="page-subtitle">
          {profile?.full_name ? `${profile.full_name} · ` : ''}{filterLabel()} · generated {formatDate(new Date().toISOString())}
        </p>
      </div>

      {report.empty ? (
        <EmptyState icon={meta.icon} title={`No ${meta.label.toLowerCase()} data`} description="Try widening the date range or clearing the farm and season filters. Records are added from the module pages." />
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            {report.tiles.map((t) => (
              <Tile key={t.label} label={t.label} value={t.value} sub={t.sub} color={t.color} />
            ))}
          </div>

          {report.chart && (
            <ReportCard title={`${meta.label} Overview`} icon={meta.icon}>
              {report.chart}
            </ReportCard>
          )}

          <ReportCard
            title={`${meta.label} Detail`}
            icon="fa-table"
            right={<span style={{ fontSize: 12, color: 'var(--text-light)' }}>{filterLabel()}</span>}
          >
            <ReportTable columns={report.columns} rows={report.tableRows} />
          </ReportCard>

          {report.extra}
        </>
      )}
    </>
  );
}
