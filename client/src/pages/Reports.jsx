import { useMemo, useRef, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { useDashboard } from '../features/dashboard/useDashboard.js';
import { baseOptions, breakdownOptions, LEAF, AMBER, INK, useIsDark } from '../features/dashboard/charts.jsx';
import { useProfile } from '../components/profile.jsx';
import { useToast } from '../components/Toast.jsx';
import { ExportMenu } from '../components/ExportMenu.jsx';
import { downloadTables } from '../lib/download.js';
import { Loading, EmptyState, StatTile } from '../components/ui.jsx';
import { formatCurrency, formatNumber, formatDate, currenciesUsed, getCurrency } from '../lib/format.js';
import { t } from '../i18n/index.js';

const REPORTS = [
  { id: 'production', label: 'Production', icon: 'fa-wheat-awn' },
  { id: 'yield', label: 'Yield', icon: 'fa-balance-scale' },
  { id: 'financial', label: 'Financial', icon: 'fa-coins' },
  { id: 'cycles', label: 'Crop Cycles', icon: 'fa-sync-alt' },
];

const CYCLE_STATUSES = ['Planned', 'Planted', 'Growing', 'Ready for Harvest', 'Harvested', 'Completed', 'Cancelled'];

const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(y, m - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};
const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/* ---- full tables for the exports: every record behind the figures, totals included ---- */
const dash = (v) => (v === null || v === undefined ? '' : v);
const cycleTable = (cycles) => ({
  title: 'Crop cycles',
  headers: ['Crop', 'Farm', 'Field', 'Season', 'Status', 'Planted', 'Expected Harvest', 'Area (ha)', 'Expected (kg)', 'Actual (kg)'],
  rows: [...cycles].sort((a, b) => (b.planting_date || '').localeCompare(a.planting_date || '')).map((r) => [
    r.crops?.name || '', r.farms?.name || '', r.fields?.name || '', r.seasons?.name || '', r.status || '',
    r.planting_date || '', r.expected_harvest_date || '', dash(r.area_planted), dash(r.expected_production), dash(r.actual_production),
  ]),
});
const harvestTable = (harvests) => ({
  title: 'Harvest records',
  headers: ['Date', 'Crop', 'Farm', 'Field', 'Quantity', 'Unit', 'Area (ha)', 'Grade', 'Quality', 'Storage', 'Labour cost', 'Transport cost', 'Other costs', 'Notes'],
  rows: [...harvests].sort((a, b) => (b.harvest_date || '').localeCompare(a.harvest_date || '')).map((h) => [
    h.harvest_date || '', h.crops?.name || h.crop_cycles?.crops?.name || '', h.farms?.name || '', h.fields?.name || '', dash(h.quantity), h.unit || '',
    dash(h.harvested_area), h.grade || '', h.quality || '', h.storage_location || '', dash(h.labor_cost), dash(h.transport_cost), dash(h.other_costs), h.notes || '',
  ]),
});
const expenseTable = (expenses, currency) => ({
  title: `Expenses (${currency})`,
  headers: ['Date', 'Category', 'Description', 'Farm', 'Supplier', 'Payment', 'Amount', 'Notes'],
  rows: [...expenses].sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '')).map((e) => [
    e.expense_date || '', e.category || '', e.description || '', e.farms?.name || '', e.supplier || '', e.payment_method || '', dash(e.amount), e.notes || '',
  ]),
});
const saleTable = (sales, currency) => ({
  title: `Sales (${currency})`,
  headers: ['Date', 'Crop', 'Buyer', 'Farm', 'Quantity', 'Unit', 'Unit price', 'Total', 'Payment', 'Market', 'Notes'],
  rows: [...sales].sort((a, b) => (b.sale_date || '').localeCompare(a.sale_date || '')).map((x) => [
    x.sale_date || '', x.crops?.name || '', x.buyer || '', x.farms?.name || '', dash(x.quantity), x.unit || '', dash(x.unit_price), dash(x.total_amount), x.payment_status || '', x.market || '', x.notes || '',
  ]),
});

/* ---- small presentational bits ---------------------------------------- */
function ReportCard({ title, icon, iconColor = 'var(--primary)', right, children, bodyStyle }) {
  return (
    <div className="chart-card full-width" style={{ marginBottom: 20 }}>
      <div className="chart-card-header">
        <h3>
          <i className={`fas ${icon}`} style={{ color: iconColor, marginRight: 8 }} />
          {t(title)}
        </h3>
        {right}
      </div>
      <div className="chart-card-body" style={bodyStyle}>{children}</div>
    </div>
  );
}

function ReportTable({ columns, rows }) {
  if (!rows.length) {
    return <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)', fontSize: 13 }}>{t('No data for the selected filters')}</div>;
  }
  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>{t(c.label)}</th>
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
    const cycleCrop = {};
    (d.cycles || []).forEach((c) => { cycleCrop[c.id] = c.crop_id || null; });
    // a record belongs to a crop directly or through its crop cycle; costs with no cycle belong to no crop
    const cropOk = (rec) => !filters.crop || (rec.crop_id || cycleCrop[rec.crop_cycle_id]) === filters.crop;

    const cycles = (d.cycles || []).filter(
      (c) => farmOk(c) && cropOk(c) && seasonOk(c, c.season_id || null) && (filters.from || filters.to ? inRange(c.planting_date) : true),
    );
    const harvests = (d.harvests || []).filter((h) => farmOk(h) && cropOk(h) && seasonOk(h) && inRange(h.harvest_date));
    const allExpenses = (d.expenses || []).filter((e) => farmOk(e) && cropOk(e) && seasonOk(e) && inRange(e.expense_date));
    const allSales = (d.sales || []).filter((s) => farmOk(s) && cropOk(s) && seasonOk(s) && inRange(s.sale_date));

    // money is never converted: the financial report covers one currency at a time
    const currencies = currenciesUsed(allSales, allExpenses);
    const currency = filters.currency && currencies.includes(filters.currency) ? filters.currency : currencies[0] || getCurrency();
    const inCurrency = (r) => (r.currency || getCurrency()) === currency;
    const expenses = allExpenses.filter(inCurrency);
    const sales = allSales.filter(inCurrency);

    return { cycles, harvests, expenses, sales, currency, currencies };
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
            { label: t('Expected (kg)'), data: rows.map((r) => Math.round(r.expected)), backgroundColor: AMBER, borderRadius: 6 },
            { label: t('Harvested (kg)'), data: rows.map((r) => Math.round(r.harvested)), backgroundColor: LEAF, borderRadius: 6 },
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
      { label: 'Planted Area', value: round1(tot.area).toLocaleString(), sub: 'ha', color: 'var(--forest)' },
      { label: 'Expected', value: formatNumber(Math.round(tot.expected)), sub: 'kg', color: 'var(--pine)' },
      { label: 'Harvested', value: formatNumber(Math.round(tot.harvested)), sub: 'kg', color: 'var(--primary)' },
      { label: 'Achievement', value: tot.expected ? `${Math.round((tot.harvested / tot.expected) * 100)}%` : '—', color: 'var(--amber)' },
    ],
    chart,
    columns,
    tableRows,
    tables: [
      {
        title: 'Production by crop',
        headers: ['Crop', 'Cycles', 'Area (ha)', 'Expected (kg)', 'Harvested (kg)', 'Yield (kg/ha)', 'Achievement (%)'],
        rows: [
          ...rows.map((r) => [r.crop, r.cycles, round1(r.area), Math.round(r.expected), Math.round(r.harvested), Math.round(r.yield), Math.round(r.achievement)]),
          ...(rows.length > 1 ? [['All crops', tot.cycles, round1(tot.area), Math.round(tot.expected), Math.round(tot.harvested), tot.area ? Math.round(tot.harvested / tot.area) : 0, tot.expected ? Math.round((tot.harvested / tot.expected) * 100) : 0]] : []),
        ],
      },
      cycleTable(cycles),
      harvestTable(harvests),
    ],
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
            data={{ labels: rows.map((r) => r.crop), datasets: [{ label: t('Yield (kg/ha)'), data: rows.map((r) => Math.round(r.yield)), backgroundColor: LEAF, borderRadius: 6 }] }}
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
              datasets: [{ label: t('Harvest (kg)'), data: mKeys.map((k) => Math.round(monthMap[k])), borderColor: LEAF, backgroundColor: LEAF, fill: false, tension: 0.4, pointRadius: 4, borderWidth: 3 }],
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
      { label: 'Harvested Area', value: round1(totArea).toLocaleString(), sub: 'ha', color: 'var(--forest)' },
      { label: 'Overall Yield', value: totArea ? formatNumber(Math.round(totQty / totArea)) : '—', sub: 'kg/ha', color: 'var(--amber)' },
      { label: 'Harvest Records', value: formatNumber(harvests.length) },
    ],
    chart,
    columns,
    tableRows,
    tables: [
      {
        title: 'Yield by crop',
        headers: ['Crop', 'Records', 'Harvested Area (ha)', 'Quantity (kg)', 'Avg Yield (kg/ha)'],
        rows: [
          ...rows.map((r) => [r.crop, r.records, round1(r.area), Math.round(r.qty), Math.round(r.yield)]),
          ...(rows.length > 1 ? [['All crops', rows.reduce((a, r) => a + r.records, 0), round1(totArea), Math.round(totQty), totArea ? Math.round(totQty / totArea) : 0]] : []),
        ],
      },
      { title: 'Harvest by month (kg)', headers: ['Month', 'Quantity (kg)'], rows: mKeys.map((k) => [monthLabel(k), Math.round(monthMap[k])]) },
      harvestTable(harvests),
    ],
  };
}

function buildFinancial({ expenses, sales, currency }, dark) {
  const money = (v) => formatCurrency(v, currency);
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
    { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => money(r.revenue) },
    { key: 'expenses', label: 'Expenses', align: 'right', render: (r) => money(r.expenses) },
    { key: 'net', label: 'Net', align: 'right', render: (r) => <span style={{ color: r.net >= 0 ? '#2E7D32' : '#C62828' }}>{money(r.net)}</span> },
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
  columns[0].render = (r) => (r._total ? t('Total') : monthLabel(r.month));

  const chart = (
    <div className="chart-grid" style={{ marginTop: 4 }}>
      <div style={{ height: 300 }}>
        {months.length ? (
          <Bar
            key={`fin-${dark}`}
            data={{
              labels: months.map((r) => monthLabel(r.month)),
              datasets: [
                { label: t('Revenue'), data: months.map((r) => Math.round(r.revenue)), backgroundColor: LEAF, borderRadius: 4, order: 2 },
                { label: t('Expenses'), data: months.map((r) => Math.round(r.expenses)), backgroundColor: AMBER, borderRadius: 4, order: 3 },
                { label: t('Net'), data: months.map((r) => Math.round(r.net)), type: 'line', borderColor: INK, backgroundColor: INK, fill: false, tension: 0.4, pointRadius: 4, borderWidth: 2, order: 1 },
              ],
            }}
            options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, valueLabels: { lines: false } } }}
          />
        ) : null}
      </div>
      <div style={{ height: 300 }}>
        {cats.length ? (
          <Bar
            key={`finc-${dark}`}
            data={{ labels: cats.map((c) => t(c.category)), datasets: [{ data: cats.map((c) => Math.round(c.amount)), backgroundColor: LEAF, borderRadius: 4 }] }}
            options={breakdownOptions()}
          />
        ) : null}
      </div>
    </div>
  );

  return {
    empty: months.length === 0,
    tiles: [
      { label: 'Total Revenue', value: money(totRev), color: '#2E7D32' },
      { label: 'Total Expenses', value: money(totExp), color: '#C62828' },
      { label: 'Net Profit', value: money(net), color: net >= 0 ? '#2E7D32' : '#C62828' },
      { label: 'Profit Margin', value: totRev ? `${Math.round((net / totRev) * 100)}%` : '—', color: 'var(--forest)' },
    ],
    chart,
    columns,
    tableRows,
    extra:
      cats.length > 0 ? (
        <ReportCard title={`${t('Expense Breakdown')} · ${currency}`} icon="fa-receipt" iconColor="var(--alert)">
          <ReportTable
            columns={[
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
              { key: 'share', label: 'Share', align: 'right', render: (r) => `${Math.round((r.amount / totExp) * 100)}%` },
            ]}
            rows={cats.map((c) => ({ ...c, _key: c.category }))}
          />
        </ReportCard>
      ) : null,
    tables: [
      {
        title: `Revenue and expenses by month (${currency})`,
        headers: ['Month', 'Revenue', 'Expenses', 'Net', 'Margin (%)'],
        rows: [
          ...months.map((r) => [monthLabel(r.month), round1(r.revenue), round1(r.expenses), round1(r.net), Math.round(r.margin)]),
          ...(months.length ? [['Total', round1(totRev), round1(totExp), round1(net), totRev ? Math.round((net / totRev) * 100) : 0]] : []),
        ],
      },
      { title: `Expense breakdown (${currency})`, headers: ['Category', 'Amount', 'Share (%)'], rows: cats.map((c) => [c.category, round1(c.amount), totExp ? Math.round((c.amount / totExp) * 100) : 0]) },
      saleTable(sales, currency),
      expenseTable(expenses, currency),
    ],
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
      <Bar
        key={`cyc-${dark}`}
        data={{ labels: CYCLE_STATUSES.map((s) => t(s)), datasets: [{ data: statusCounts, backgroundColor: LEAF, borderRadius: 4 }] }}
        options={breakdownOptions()}
      />
    </div>
  ) : null;

  return {
    empty: cycles.length === 0,
    tiles: [
      { label: 'Total Cycles', value: formatNumber(cycles.length) },
      { label: 'Active', value: formatNumber(active), color: 'var(--primary)' },
      { label: 'Completed', value: formatNumber(completed), color: 'var(--forest)' },
      { label: 'Planted Area', value: round1(area).toLocaleString(), sub: 'ha', color: 'var(--amber)' },
    ],
    chart,
    columns,
    tableRows: rows.map((r) => ({ ...r, _key: r.id })),
    tables: [cycleTable(cycles)],
  };
}

const BUILDERS = { production: buildProduction, yield: buildYield, financial: buildFinancial, cycles: buildCycles };

/* ---- page ------------------------------------------------------------- */
export default function Reports() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const { profile } = useProfile();
  const toast = useToast();
  const dark = useIsDark();
  const bodyRef = useRef(null);
    const [active, setActive] = useState('production');
  const [filters, setFilters] = useState({ farm: '', crop: '', season: '', from: '', to: '', currency: '' });

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
  const cropName = (d.crops || []).find((x) => x.id === filters.crop)?.name || '';
  const reportTitle = `${cropName ? `${cropName} · ` : ''}${t('{{report}} Report', { report: t(meta.label) })}`;
  const sections = () => report.tables.filter((x) => x.rows.length);
  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const filterLabel = () => {
    const parts = [];
    if (filters.crop) parts.push(`${t('Crop')}: ${cropName}`);
    if (filters.farm) parts.push((d.farms || []).find((x) => x.id === filters.farm)?.name);
    if (filters.season) parts.push((d.seasons || []).find((x) => x.id === filters.season)?.name);
    if (filters.from || filters.to) parts.push(`${filters.from || '…'} → ${filters.to || '…'}`);
    if (active === 'financial') parts.push(t('amounts in {{currency}}', { currency: filtered.currency }));
    return parts.filter(Boolean).join(' · ') || t('All farms · all time');
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportPDF = async () => {
    const { downloadDocPdf } = await import('../lib/pdfReport.js');
    await downloadDocPdf({
      kind: t('Report'),
      title: reportTitle,
      meta: [[profile?.full_name, profile?.public_id].filter(Boolean).join(' · '), filterLabel()],
      fileName: `CropManager-${active}${cropName ? `-${cropName}` : ''}-report-${stamp()}.pdf`,
      sections: [
        { type: 'tiles', tiles: report.tiles },
        { type: 'charts', root: bodyRef.current, dark, title: t('Overview') },
        ...sections().map((x) => ({ type: 'table', title: t(x.title), headers: x.headers, rows: x.rows })),
      ],
    });
    toast('Report downloaded as PDF', 'info');
  };

  const exportReport = async (format) => {
    if (format === 'pdf') return exportPDF();
    await downloadTables(format, {
      kind: 'Report', title: reportTitle, subtitle: filterLabel(),
      tables: sections().map((x) => ({ title: t(x.title), headers: x.headers.map((h) => t(h)), rows: x.rows })),
    }, `${active}-report-${stamp()}.${format}`);
    toast(format === 'xlsx' ? 'Report exported as Excel' : 'Report exported as CSV', 'info');
    return undefined;
  };

  return (
    <>
      <div className="dashboard-header no-print">
        <div>
          <h1 className="page-title">{t('Reports')}</h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>{t('Production, yield and financial reporting.')}</p>
        </div>
        <div className="dashboard-filters">
          <select className="dashboard-filter-select" value={filters.farm} onChange={setF('farm')}>
            <option value="">{t('All Farms')}</option>
            {(d.farms || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="dashboard-filter-select" value={filters.crop} onChange={setF('crop')} aria-label={t('Crop')}>
            <option value="">{t('All Crops')}</option>
            {(d.crops || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="dashboard-filter-select" value={filters.season} onChange={setF('season')}>
            <option value="">{t('All Seasons')}</option>
            {(d.seasons || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.from} onChange={setF('from')} />
          <input type="date" className="dashboard-filter-select" style={{ padding: '7px 10px' }} value={filters.to} onChange={setF('to')} />
          {filtered.currencies.length > 1 && (
            <select className="dashboard-filter-select" value={filtered.currency} onChange={setF('currency')} aria-label="Currency">
              {filtered.currencies.map((c) => <option key={c} value={c}>Money in {c}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="report-tabs no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {REPORTS.map((r) => (
          <button
            key={r.id}
            className={`btn btn-sm ${active === r.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActive(r.id)}
          >
            <i className={`fas ${r.icon}`} /> {t(r.label)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <ExportMenu run={exportReport} disabled={report.empty} />
        <button className="btn btn-sm btn-secondary" onClick={() => window.print()}>
          <i className="fas fa-print" /> {t('Print')}
        </button>
      </div>

      <div className="print-only" style={{ marginBottom: 12 }}>
        <h1 className="page-title">{reportTitle}</h1>
        <p className="page-subtitle">
          {[profile?.full_name, profile?.public_id].filter(Boolean).join(' · ') ? `${[profile?.full_name, profile?.public_id].filter(Boolean).join(' · ')} · ` : ''}{filterLabel()} · {t('generated {{date}}', { date: formatDate(new Date().toISOString()) })}
        </p>
      </div>

      <div ref={bodyRef}>
      {report.empty ? (
        <EmptyState icon={meta.icon} title={t('No {{report}} data', { report: t(meta.label).toLowerCase() })} description="Try widening the date range or clearing the farm and season filters. Records are added from the module pages." />
      ) : (
        <>
          <div className="stat-grid" style={{ '--stat-min': '150px', marginBottom: 20 }}>
            {report.tiles.map((tile) => (
              <StatTile key={tile.label} label={tile.label} value={tile.value} sub={tile.sub} color={tile.color} />
            ))}
          </div>

          {report.chart && (
            <ReportCard title={t('{{report}} Overview', { report: t(meta.label) })} icon={meta.icon}>
              {report.chart}
            </ReportCard>
          )}

          <ReportCard
            title={t('{{report}} Detail', { report: t(meta.label) })}
            icon="fa-table"
            right={<span style={{ fontSize: 12, color: 'var(--text-light)' }}>{filterLabel()}</span>}
          >
            <ReportTable columns={report.columns} rows={report.tableRows} />
          </ReportCard>

          {report.extra}
        </>
      )}
      </div>
    </>
  );
}
