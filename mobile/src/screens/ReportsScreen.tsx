import React, { useMemo, useState } from 'react';
import { RefreshControl, TextInput, View } from 'react-native';
import { useDashboard } from '../lib/useResource';
import { currenciesUsed, formatCurrency, formatDate, formatNumber, getCurrency } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Badge, ChartCard, EmptyState, Grid, Loading, PageHeader, Screen, StatTile, useLayout } from '../components/ui';
import { Bars, HBars, LineChart } from '../components/charts';
import { DateField, SelectField } from '../components/fields';
import { Button } from '../components/Button';
import { ExportButton } from '../components/ExportSheet';
import { shareTables } from '../lib/exports';
import { shareReportPdf } from '../lib/pdfReport';
import { useProfile } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { CYCLE_STATUSES, STATUS_COLORS } from '../features/dashboard/aggregate';
import { t } from '../i18n';

/*
 * Mirrors the web Reports page (client/src/pages/Reports.jsx): farm/season/date
 * filters, Production / Yield / Financial / Crop Cycles tabs, coloured summary tiles,
 * an overview chart, a detail table, and CSV export (via the share sheet on phones).
 */
const REPORTS = [
  { id: 'production', label: 'Production', icon: 'wheat-awn' },
  { id: 'yield', label: 'Yield', icon: 'scale-balanced' },
  { id: 'financial', label: 'Financial', icon: 'coins' },
  { id: 'cycles', label: 'Crop Cycles', icon: 'rotate' },
] as const;
type ReportId = (typeof REPORTS)[number]['id'];

const n = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round1 = (x: number) => Math.round((x + Number.EPSILON) * 10) / 10;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};

/* full tables for the exports: every record behind the figures, totals included */
const dash = (v: any) => (v === null || v === undefined ? '' : v);
const cycleTable = (cycles: any[]) => ({
  title: 'Crop cycles',
  headers: ['Crop', 'Farm', 'Field', 'Season', 'Status', 'Planted', 'Expected Harvest', 'Area (ha)', 'Expected (kg)', 'Actual (kg)'],
  rows: [...cycles].sort((a, b) => (b.planting_date || '').localeCompare(a.planting_date || '')).map((r) => [
    r.crops?.name || '', r.farms?.name || '', r.fields?.name || '', r.seasons?.name || '', r.status || '',
    r.planting_date || '', r.expected_harvest_date || '', dash(r.area_planted), dash(r.expected_production), dash(r.actual_production),
  ]),
});
const harvestTable = (harvests: any[]) => ({
  title: 'Harvest records',
  headers: ['Date', 'Crop', 'Farm', 'Field', 'Quantity', 'Unit', 'Area (ha)', 'Grade', 'Quality', 'Storage', 'Labour cost', 'Transport cost', 'Other costs', 'Notes'],
  rows: [...harvests].sort((a, b) => (b.harvest_date || '').localeCompare(a.harvest_date || '')).map((h) => [
    h.harvest_date || '', h.crops?.name || h.crop_cycles?.crops?.name || '', h.farms?.name || '', h.fields?.name || '', dash(h.quantity), h.unit || '',
    dash(h.harvested_area), h.grade || '', h.quality || '', h.storage_location || '', dash(h.labor_cost), dash(h.transport_cost), dash(h.other_costs), h.notes || '',
  ]),
});
const expenseTable = (expenses: any[], currency: string) => ({
  title: `Expenses (${currency})`,
  headers: ['Date', 'Category', 'Description', 'Farm', 'Supplier', 'Payment', 'Amount', 'Notes'],
  rows: [...expenses].sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '')).map((e) => [
    e.expense_date || '', e.category || '', e.description || '', e.farms?.name || '', e.supplier || '', e.payment_method || '', dash(e.amount), e.notes || '',
  ]),
});
const saleTable = (sales: any[], currency: string) => ({
  title: `Sales (${currency})`,
  headers: ['Date', 'Crop', 'Buyer', 'Farm', 'Quantity', 'Unit', 'Unit price', 'Total', 'Payment', 'Market', 'Notes'],
  rows: [...sales].sort((a, b) => (b.sale_date || '').localeCompare(a.sale_date || '')).map((x) => [
    x.sale_date || '', x.crops?.name || '', x.buyer || '', x.farms?.name || '', dash(x.quantity), x.unit || '', dash(x.unit_price), dash(x.total_amount), x.payment_status || '', x.market || '', x.notes || '',
  ]),
});

type Column = { key: string; label: string; align?: 'right'; render?: (r: any) => React.ReactNode };
type Built = {
  empty: boolean;
  tiles: { label: string; value: string; sub?: string; color?: string }[];
  chart: React.ReactNode;
  columns: Column[];
  rows: any[];
  tables: { title: string; headers: string[]; rows: any[][] }[];
  extra?: { title: string; columns: Column[]; rows: any[] };
};

export function ReportsScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();
  const { colors } = useTheme();
  const toast = useToast();
  const { profile } = useProfile();
  const [active, setActive] = useState<ReportId>('production');
  const [filters, setFilters] = useState({ farm: '', crop: '', season: '', from: '', to: '', currency: '' });

  const d = data || {};

  // same filtering as the web's useFilteredData (season resolved through the crop cycle)
  const filtered = useMemo(() => {
    const cycleSeason: Record<string, string | null> = {};
    (d.cycles || []).forEach((c: any) => { cycleSeason[c.id] = c.season_id || null; });
    const inRange = (date?: string) => {
      if (!date) return !filters.from && !filters.to;
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      return true;
    };
    const seasonOk = (rec: any, own?: string | null) => {
      if (!filters.season) return true;
      const s = own !== undefined ? own : cycleSeason[rec.crop_cycle_id];
      return s === filters.season;
    };
    const farmOk = (r: any) => !filters.farm || r.farm_id === filters.farm;
    const cycleCrop: Record<string, string | null> = {};
    (d.cycles || []).forEach((c: any) => { cycleCrop[c.id] = c.crop_id || null; });
    // a record belongs to a crop directly or through its crop cycle; costs with no cycle belong to no crop
    const cropOk = (r: any) => !filters.crop || (r.crop_id || cycleCrop[r.crop_cycle_id]) === filters.crop;
    const allExpenses = (d.expenses || []).filter((e: any) => farmOk(e) && cropOk(e) && seasonOk(e) && inRange(e.expense_date));
    const allSales = (d.sales || []).filter((s: any) => farmOk(s) && cropOk(s) && seasonOk(s) && inRange(s.sale_date));
    // money is never converted: the financial report covers one currency at a time
    const currencies = currenciesUsed(allSales, allExpenses);
    const currency = filters.currency && currencies.includes(filters.currency) ? filters.currency : currencies[0] || getCurrency();
    const inCurrency = (r: any) => (r.currency || getCurrency()) === currency;
    return {
      cycles: (d.cycles || []).filter((c: any) => farmOk(c) && cropOk(c) && seasonOk(c, c.season_id || null) && (filters.from || filters.to ? inRange(c.planting_date) : true)),
      harvests: (d.harvests || []).filter((h: any) => farmOk(h) && cropOk(h) && seasonOk(h) && inRange(h.harvest_date)),
      expenses: allExpenses.filter(inCurrency),
      sales: allSales.filter(inCurrency),
      currency,
      currencies,
    };
  }, [d, filters]);

  const report = useMemo(() => build(active, filtered), [active, filtered]);
  const [rq, setRq] = useState('');
  // the search box narrows the detail table (total rows stay)
  const shownRows = useMemo(() => {
    const nd = rq.trim().toLowerCase();
    if (!nd) return report.rows;
    return report.rows.filter((r: any) => r._total || Object.entries(r).some(([k, v]) => !k.startsWith('_') && v !== null && typeof v !== 'object' && String(v).toLowerCase().includes(nd)) || [r.crops?.name, r.farms?.name, r.fields?.name, r.seasons?.name].some((x: any) => x && String(x).toLowerCase().includes(nd)));
  }, [report, rq]);
  const meta = REPORTS.find((r) => r.id === active)!;
  const cropName = ((d.crops || []) as any[]).find((x) => x.id === filters.crop)?.name || '';
  const reportTitle = `${cropName ? `${cropName} · ` : ''}${t('{{report}} Report', { report: t(meta.label) })}`;

  if (isLoading) return <Loading label="Loading report data..." />;
  if (isError) {
    return <EmptyState icon="triangle-exclamation" title="Could not load reports" description="There was a problem fetching your data." actionLabel="Retry" onAction={refetch} />;
  }

  const set = (k: keyof typeof filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const filterLabel = () => {
    const parts: string[] = [];
    if (filters.crop) parts.push(`${t('Crop')}: ${cropName}`);
    if (filters.farm) parts.push(((d.farms || []) as any[]).find((x) => x.id === filters.farm)?.name);
    if (filters.season) parts.push(((d.seasons || []) as any[]).find((x) => x.id === filters.season)?.name);
    if (filters.from || filters.to) parts.push(`${filters.from || '…'} → ${filters.to || '…'}`);
    if (active === 'financial') parts.push(t('amounts in {{currency}}', { currency: filtered.currency }));
    return parts.filter(Boolean).join(' · ') || t('All farms · all time');
  };
  const sections = () => report.tables.filter((x) => x.rows.length);
  const exportReport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    if (format === 'pdf') {
      await shareReportPdf({ title: reportTitle, subtitle: filterLabel(), owner: [profile?.full_name, profile?.public_id].filter(Boolean).join(' · '), tiles: report.tiles, tables: sections() });
      return;
    }
    await shareTables(format, {
      kind: 'Report', title: reportTitle, subtitle: filterLabel(),
      tables: sections().map((x) => ({ title: t(x.title), headers: x.headers.map((h) => t(h)), rows: x.rows })),
    }, `${active}-report.${format}`);
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Reports" subtitle="Production, yield and financial reporting." />
      {cropName ? <AppText weight="700" style={{ fontSize: 15, color: colors.primaryDark, marginBottom: 10 }}>{reportTitle}</AppText> : null}

      <Grid columns={2} gap={10} style={{ marginBottom: 16 }}>
        <SelectField value={filters.farm} onChangeValue={set('farm')} placeholder="All Farms" options={(d.farms || []).map((f: any) => ({ value: f.id, label: f.name }))} />
        <SelectField value={filters.crop} onChangeValue={set('crop')} placeholder="All Crops" options={(d.crops || []).map((c: any) => ({ value: c.id, label: c.name }))} />
        <SelectField value={filters.season} onChangeValue={set('season')} placeholder="All Seasons" options={(d.seasons || []).map((s: any) => ({ value: s.id, label: s.name }))} />
        <DateField value={filters.from} onChangeValue={set('from')} />
        <DateField value={filters.to} onChangeValue={set('to')} />
        {filtered.currencies.length > 1 ? (
          <SelectField
            value={filtered.currency}
            onChangeValue={set('currency')}
            options={filtered.currencies.map((c: string) => ({ value: c, label: `Money in ${c}` }))}
            placeholder=""
          />
        ) : null}
      </Grid>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, minHeight: 40, marginBottom: 12 }}>
        <TextInput value={rq} onChangeText={setRq} placeholder={t('Search this report...')} placeholderTextColor={colors.placeholder} style={{ flex: 1, paddingVertical: 8, color: colors.text, fontSize: 13 }} />
      </View>

      {/* .report-tabs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {REPORTS.map((r) => (
          <Button key={r.id} title={r.label} icon={r.icon} size="sm" kind={active === r.id ? 'primary' : 'secondary'} onPress={() => setActive(r.id)} />
        ))}
        <View style={{ flexGrow: 1 }} />
        <ExportButton size="sm" disabled={report.empty} run={exportReport} />
      </View>

      {report.empty ? (
        <EmptyState
          icon={meta.icon}
          title={`No ${meta.label.toLowerCase()} data`}
          description="Try widening the date range or clearing the farm and season filters. Records are added from the module pages."
        />
      ) : (
        <View style={{ gap: 20 }}>
          <Grid columns={2} gap={12}>
            {report.tiles.map((tile) => (
              <StatTile key={tile.label} label={tile.label} value={tile.value} sub={tile.sub} color={tile.color} />
            ))}
          </Grid>

          {report.chart ? (
            <ChartCard title={t('{{report}} Overview', { report: t(meta.label) })} icon={meta.icon}>{report.chart}</ChartCard>
          ) : null}

          <ChartCard title={t('{{report}} Detail', { report: t(meta.label) })} icon="table" bodyStyle={{ padding: 0 }}>
            <ReportTable columns={report.columns} rows={shownRows} />
          </ChartCard>

          {report.extra ? (
            <ChartCard title={report.extra.title} icon="receipt" iconColor={colors.red} bodyStyle={{ padding: 0 }}>
              <ReportTable columns={report.extra.columns} rows={report.extra.rows} />
            </ChartCard>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** web .data-table: real columns on tablets; label/value rows on phones. */
function ReportTable({ columns, rows }: { columns: Column[]; rows: any[] }) {
  const { colors } = useTheme();
  const { isTablet } = useLayout();
  const cell = (c: Column, r: any) => (c.render ? c.render(r) : r[c.key] ?? '—');
  const text = (v: React.ReactNode, style: any) =>
    typeof v === 'string' || typeof v === 'number' ? <AppText style={style} numberOfLines={2}>{String(v)}</AppText> : v;

  if (!rows.length) {
    return <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', padding: 24 }}>{t('No data for the selected filters')}</AppText>;
  }

  if (isTablet) {
    return (
      <View>
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {columns.map((c) => (
            <AppText key={c.key} weight="700" style={{ flex: 1, fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, paddingVertical: 12, paddingHorizontal: 16, textAlign: c.align === 'right' ? 'right' : 'left' }}>
              {t(c.label)}
            </AppText>
          ))}
        </View>
        {rows.map((r, i) => (
          <View key={r._key ?? i} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border, backgroundColor: r._total ? colors.bg : 'transparent' }}>
            {columns.map((c) => (
              <View key={c.key} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 16, alignItems: c.align === 'right' ? 'flex-end' : 'flex-start' }}>
                {text(cell(c, r), { fontSize: 13, fontFamily: undefined, fontWeight: r._total ? '700' : '400', textAlign: c.align === 'right' ? 'right' : 'left' })}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  const [first, ...rest] = columns;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r._key ?? i} style={{ padding: 16, gap: 8, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border, backgroundColor: r._total ? colors.bg : 'transparent' }}>
          {text(cell(first, r), { fontSize: 14, fontWeight: '700' })}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
            {rest.map((c) => (
              <View key={c.key} style={{ width: '50%', paddingRight: 8 }}>
                <AppText weight="700" style={{ fontSize: 10, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(c.label)}</AppText>
                {text(cell(c, r), { fontSize: 13, marginTop: 1, fontWeight: r._total ? '700' : '400' })}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- builders */
function build(id: ReportId, f: any): Built {
  if (id === 'production') {
    const map: Record<string, any> = {};
    const get = (nm: string) => (map[nm] ||= { crop: nm, cycles: 0, area: 0, expected: 0, harvested: 0 });
    f.cycles.forEach((c: any) => {
      const r = get(c.crops?.name || 'Unknown');
      r.cycles += 1;
      if (!['Planned', 'Cancelled'].includes(c.status)) r.area += n(c.area_planted);
      r.expected += n(c.expected_production);
    });
    f.harvests.forEach((h: any) => { get(h.crops?.name || h.crop_cycles?.crops?.name || 'Unknown').harvested += n(h.quantity); });
    const rows = Object.values(map)
      .map((r: any) => ({ ...r, yield: r.area > 0 ? r.harvested / r.area : 0, achievement: r.expected > 0 ? (r.harvested / r.expected) * 100 : 0 }))
      .sort((a: any, b: any) => b.harvested - a.harvested);
    const tot = rows.reduce((s: any, r: any) => ({ cycles: s.cycles + r.cycles, area: s.area + r.area, expected: s.expected + r.expected, harvested: s.harvested + r.harvested }), { cycles: 0, area: 0, expected: 0, harvested: 0 });
    return {
      empty: rows.length === 0,
      tiles: [
        { label: 'Crop Cycles', value: formatNumber(tot.cycles) },
        { label: 'Planted Area', value: round1(tot.area).toLocaleString(), sub: 'ha', color: '#1B5E20' },
        { label: 'Expected', value: formatNumber(Math.round(tot.expected)), sub: 'kg', color: '#5B6B5D' },
        { label: 'Harvested', value: formatNumber(Math.round(tot.harvested)), sub: 'kg', color: '#2E7D32' },
        { label: 'Achievement', value: tot.expected ? `${Math.round((tot.harvested / tot.expected) * 100)}%` : '—', color: '#1C2B1E' },
      ],
      chart: (
        <Bars
          labels={rows.map((r: any) => r.crop)}
          datasets={[
            { label: 'Expected (kg)', data: rows.map((r: any) => Math.round(r.expected)), color: '#F9A825' },
            { label: 'Harvested (kg)', data: rows.map((r: any) => Math.round(r.harvested)), color: '#2E7D32' },
          ]}
        />
      ),
      columns: [
        { key: 'crop', label: 'Crop' },
        { key: 'cycles', label: 'Cycles', align: 'right' },
        { key: 'area', label: 'Area (ha)', align: 'right', render: (r) => round1(r.area).toLocaleString() },
        { key: 'expected', label: 'Expected (kg)', align: 'right', render: (r) => formatNumber(Math.round(r.expected)) },
        { key: 'harvested', label: 'Harvested (kg)', align: 'right', render: (r) => formatNumber(Math.round(r.harvested)) },
        { key: 'yield', label: 'Yield (kg/ha)', align: 'right', render: (r) => (r.yield ? formatNumber(Math.round(r.yield)) : '—') },
        { key: 'achievement', label: 'Achievement', align: 'right', render: (r) => (r.expected ? `${Math.round(r.achievement)}%` : '—') },
      ],
      rows: [
        ...rows.map((r: any) => ({ ...r, _key: r.crop })),
        ...(rows.length > 1
          ? [{
              _key: '__total', _total: true, crop: 'All crops', cycles: tot.cycles, area: tot.area, expected: tot.expected, harvested: tot.harvested,
              yield: tot.area > 0 ? tot.harvested / tot.area : 0, achievement: tot.expected > 0 ? (tot.harvested / tot.expected) * 100 : 0,
            }]
          : []),
      ],
      tables: [
        {
          title: 'Production by crop',
          headers: ['Crop', 'Cycles', 'Area (ha)', 'Expected (kg)', 'Harvested (kg)', 'Yield (kg/ha)', 'Achievement (%)'],
          rows: [
            ...rows.map((r: any) => [r.crop, r.cycles, round1(r.area), Math.round(r.expected), Math.round(r.harvested), Math.round(r.yield), Math.round(r.achievement)]),
            ...(rows.length > 1 ? [['All crops', tot.cycles, round1(tot.area), Math.round(tot.expected), Math.round(tot.harvested), tot.area ? Math.round(tot.harvested / tot.area) : 0, tot.expected ? Math.round((tot.harvested / tot.expected) * 100) : 0]] : []),
          ],
        },
        cycleTable(f.cycles),
        harvestTable(f.harvests),
      ],
    };
  }

  if (id === 'yield') {
    const map: Record<string, any> = {};
    const get = (nm: string) => (map[nm] ||= { crop: nm, records: 0, area: 0, qty: 0 });
    f.harvests.forEach((h: any) => {
      const r = get(h.crops?.name || h.crop_cycles?.crops?.name || 'Unknown');
      r.records += 1;
      r.area += n(h.harvested_area);
      r.qty += n(h.quantity);
    });
    const rows = Object.values(map).map((r: any) => ({ ...r, yield: r.area > 0 ? r.qty / r.area : 0 })).sort((a: any, b: any) => b.yield - a.yield);
    const totQty = rows.reduce((s: number, r: any) => s + r.qty, 0);
    const totArea = rows.reduce((s: number, r: any) => s + r.area, 0);
    const monthMap: Record<string, number> = {};
    f.harvests.forEach((h: any) => { if (h.harvest_date) { const k = h.harvest_date.substring(0, 7); monthMap[k] = (monthMap[k] || 0) + n(h.quantity); } });
    const mKeys = Object.keys(monthMap).sort();
    return {
      empty: rows.length === 0,
      tiles: [
        { label: 'Total Harvested', value: formatNumber(Math.round(totQty)), sub: 'kg', color: '#2E7D32' },
        { label: 'Harvested Area', value: round1(totArea).toLocaleString(), sub: 'ha', color: '#1B5E20' },
        { label: 'Overall Yield', value: totArea ? formatNumber(Math.round(totQty / totArea)) : '—', sub: 'kg/ha', color: '#1C2B1E' },
        { label: 'Harvest Records', value: formatNumber(f.harvests.length) },
      ],
      chart: (
        <View style={{ gap: 20 }}>
          <Bars labels={rows.map((r: any) => r.crop)} datasets={[{ label: 'Yield (kg/ha)', data: rows.map((r: any) => Math.round(r.yield)) }]} />
          <LineChart labels={mKeys.map(monthLabel)} data={mKeys.map((k) => Math.round(monthMap[k]))} label="Harvest (kg)" />
        </View>
      ),
      columns: [
        { key: 'crop', label: 'Crop' },
        { key: 'records', label: 'Records', align: 'right' },
        { key: 'area', label: 'Harvested Area (ha)', align: 'right', render: (r) => (r.area ? round1(r.area).toLocaleString() : '—') },
        { key: 'qty', label: 'Quantity (kg)', align: 'right', render: (r) => formatNumber(Math.round(r.qty)) },
        { key: 'yield', label: 'Avg Yield (kg/ha)', align: 'right', render: (r) => (r.yield ? formatNumber(Math.round(r.yield)) : '—') },
      ],
      rows: [
        ...rows.map((r: any) => ({ ...r, _key: r.crop })),
        ...(rows.length > 1
          ? [{ _key: '__total', _total: true, crop: 'All crops', records: rows.reduce((s: number, r: any) => s + r.records, 0), area: totArea, qty: totQty, yield: totArea > 0 ? totQty / totArea : 0 }]
          : []),
      ],
      tables: [
        {
          title: 'Yield by crop',
          headers: ['Crop', 'Records', 'Harvested Area (ha)', 'Quantity (kg)', 'Avg Yield (kg/ha)'],
          rows: [
            ...rows.map((r: any) => [r.crop, r.records, round1(r.area), Math.round(r.qty), Math.round(r.yield)]),
            ...(rows.length > 1 ? [['All crops', rows.reduce((a: number, r: any) => a + r.records, 0), round1(totArea), Math.round(totQty), totArea ? Math.round(totQty / totArea) : 0]] : []),
          ],
        },
        { title: 'Harvest by month (kg)', headers: ['Month', 'Quantity (kg)'], rows: mKeys.map((k) => [monthLabel(k), Math.round(monthMap[k])]) },
        harvestTable(f.harvests),
      ],
    };
  }

  if (id === 'financial') {
    const byMonth: Record<string, any> = {};
    const m = (k: string) => (byMonth[k] ||= { month: k, revenue: 0, expenses: 0 });
    f.sales.forEach((s: any) => { if (s.sale_date) m(s.sale_date.substring(0, 7)).revenue += n(s.total_amount); });
    f.expenses.forEach((e: any) => { if (e.expense_date) m(e.expense_date.substring(0, 7)).expenses += n(e.amount); });
    const months = Object.values(byMonth)
      .map((r: any) => ({ ...r, net: r.revenue - r.expenses, margin: r.revenue > 0 ? ((r.revenue - r.expenses) / r.revenue) * 100 : 0 }))
      .sort((a: any, b: any) => a.month.localeCompare(b.month));
    const money = (v: number) => formatCurrency(v, f.currency);
    const totRev = f.sales.reduce((s: number, x: any) => s + n(x.total_amount), 0);
    const totExp = f.expenses.reduce((s: number, x: any) => s + n(x.amount), 0);
    const net = totRev - totExp;
    const catMap: Record<string, number> = {};
    f.expenses.forEach((e: any) => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + n(e.amount); });
    const cats = Object.entries(catMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    const netColor = (v: number) => (v >= 0 ? '#2E7D32' : '#C62828');
    return {
      empty: months.length === 0,
      tiles: [
        { label: 'Total Revenue', value: money(totRev), color: '#2E7D32' },
        { label: 'Total Expenses', value: money(totExp), color: '#C62828' },
        { label: 'Net Profit', value: money(net), color: netColor(net) },
        { label: 'Profit Margin', value: totRev ? `${Math.round((net / totRev) * 100)}%` : '—', color: '#1B5E20' },
      ],
      chart: (
        <View style={{ gap: 20 }}>
          <Bars
            labels={months.map((r: any) => monthLabel(r.month))}
            datasets={[
              { label: 'Revenue', data: months.map((r: any) => Math.round(r.revenue)), color: '#2E7D32' },
              { label: 'Expenses', data: months.map((r: any) => Math.round(r.expenses)), color: '#F9A825' },
            ]}
          />
          {cats.length ? <HBars data={cats.map((c) => ({ label: c.category, value: Math.round(c.amount) }))} /> : null}
        </View>
      ),
      columns: [
        { key: 'month', label: 'Month', render: (r) => (r._total ? 'Total' : monthLabel(r.month)) },
        { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => money(r.revenue) },
        { key: 'expenses', label: 'Expenses', align: 'right', render: (r) => money(r.expenses) },
        { key: 'net', label: 'Net', align: 'right', render: (r) => <AppText style={{ fontSize: 13, color: netColor(r.net) }}>{money(r.net)}</AppText> },
        { key: 'margin', label: 'Margin', align: 'right', render: (r) => (r.revenue ? `${Math.round(r.margin)}%` : '—') },
      ],
      rows: [
        ...months.map((r: any) => ({ ...r, _key: r.month })),
        ...(months.length ? [{ _key: '__total', _total: true, month: '__', revenue: totRev, expenses: totExp, net, margin: totRev ? (net / totRev) * 100 : 0 }] : []),
      ],
      extra: cats.length
        ? {
            title: `Expense Breakdown · ${f.currency}`,
            columns: [
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount, f.currency) },
              { key: 'share', label: 'Share', align: 'right', render: (r) => `${Math.round((r.amount / totExp) * 100)}%` },
            ],
            rows: cats.map((c) => ({ ...c, _key: c.category })),
          }
        : undefined,
      tables: [
        {
          title: `Revenue and expenses by month (${f.currency})`,
          headers: ['Month', 'Revenue', 'Expenses', 'Net', 'Margin (%)'],
          rows: [
            ...months.map((r: any) => [monthLabel(r.month), round1(r.revenue), round1(r.expenses), round1(r.net), Math.round(r.margin)]),
            ...(months.length ? [['Total', round1(totRev), round1(totExp), round1(net), totRev ? Math.round((net / totRev) * 100) : 0]] : []),
          ],
        },
        { title: `Expense breakdown (${f.currency})`, headers: ['Category', 'Amount', 'Share (%)'], rows: cats.map((c) => [c.category, round1(c.amount), totExp ? Math.round((c.amount / totExp) * 100) : 0]) },
        saleTable(f.sales, f.currency),
        expenseTable(f.expenses, f.currency),
      ],
    };
  }

  // crop cycles
  const rows = [...f.cycles].sort((a: any, b: any) => (b.planting_date || '').localeCompare(a.planting_date || ''));
  const active = f.cycles.filter((c: any) => ['Planted', 'Growing', 'Ready for Harvest'].includes(c.status)).length;
  const completed = f.cycles.filter((c: any) => ['Harvested', 'Completed'].includes(c.status)).length;
  const area = f.cycles.filter((c: any) => !['Planned', 'Cancelled'].includes(c.status)).reduce((s: number, c: any) => s + n(c.area_planted), 0);
  return {
    empty: f.cycles.length === 0,
    tiles: [
      { label: 'Total Cycles', value: formatNumber(f.cycles.length) },
      { label: 'Active', value: formatNumber(active), color: '#2E7D32' },
      { label: 'Completed', value: formatNumber(completed), color: '#1B5E20' },
      { label: 'Planted Area', value: round1(area).toLocaleString(), sub: 'ha', color: '#1C2B1E' },
    ],
    chart: (
      <HBars
        data={CYCLE_STATUSES.map((s, i) => ({ label: s, value: f.cycles.filter((c: any) => c.status === s).length, color: STATUS_COLORS[i] }))}
      />
    ),
    columns: [
      { key: 'crop', label: 'Crop', render: (r) => r.crops?.name || '—' },
      { key: 'farm', label: 'Farm', render: (r) => r.farms?.name || '—' },
      { key: 'field', label: 'Field', render: (r) => r.fields?.name || '—' },
      { key: 'season', label: 'Season', render: (r) => r.seasons?.name || '—' },
      { key: 'status', label: 'Status', render: (r) => <Badge label={r.status || '—'} tone="neutral" /> },
      { key: 'planting_date', label: 'Planted', render: (r) => formatDate(r.planting_date) },
      { key: 'expected_harvest_date', label: 'Exp. Harvest', render: (r) => formatDate(r.expected_harvest_date) },
      { key: 'area_planted', label: 'Area (ha)', align: 'right', render: (r) => (r.area_planted ? round1(r.area_planted).toLocaleString() : '—') },
    ],
    rows: rows.map((r: any) => ({ ...r, _key: r.id })),
    tables: [cycleTable(f.cycles)],
  };
}
