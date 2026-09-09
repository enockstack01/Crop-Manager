import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDashboard } from '../lib/useResource';
import { formatCurrency, formatNumber } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText, Card, EmptyState, Loading, Screen, ScreenScrollHost, SectionTitle } from '../components/ui';
import { Bars } from '../components/charts';
import { Sheet } from '../components/Sheet';
import { SelectField } from '../components/fields';

const REPORTS = [
  { id: 'production', label: 'Production', icon: 'barley' },
  { id: 'yield', label: 'Yield', icon: 'scale-balance' },
  { id: 'financial', label: 'Financial', icon: 'cash' },
] as const;

type ReportId = (typeof REPORTS)[number]['id'];
const n = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

export function ReportsScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();
  const { colors } = useTheme();
  const [active, setActive] = useState<ReportId>('production');
  const [filters, setFilters] = useState({ farm: '', from: '', to: '' });
  const [filterOpen, setFilterOpen] = useState(false);

  const d = data || {};

  const filtered = useMemo(() => {
    const inRange = (date?: string) => {
      if (!date) return !filters.from && !filters.to;
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      return true;
    };
    const farmOk = (r: any) => !filters.farm || r.farm_id === filters.farm;
    return {
      cycles: (d.cycles || []).filter((c: any) => farmOk(c) && (filters.from || filters.to ? inRange(c.planting_date) : true)),
      harvests: (d.harvests || []).filter((h: any) => farmOk(h) && inRange(h.harvest_date)),
      expenses: (d.expenses || []).filter((e: any) => farmOk(e) && inRange(e.expense_date)),
      sales: (d.sales || []).filter((s: any) => farmOk(s) && inRange(s.sale_date)),
    };
  }, [d, filters]);

  const report = useMemo(() => build(active, filtered), [active, filtered]);

  if (isLoading) return <Loading label="Loading report data…" />;
  if (isError) return <EmptyState icon="alert" title="Could not load reports" actionLabel="Retry" onAction={refetch} />;

  const activeFilters = [filters.farm, filters.from, filters.to].filter(Boolean).length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="subtitle">Production, yield and financial reporting.</AppText>
        <Pressable
          onPress={() => setFilterOpen(true)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8,
            borderRadius: radius.md, backgroundColor: activeFilters ? colors.primary : colors.card,
            borderWidth: 1, borderColor: activeFilters ? colors.primary : colors.border,
          }}
        >
          <MaterialCommunityIcons name="filter-variant" size={16} color={activeFilters ? '#fff' : colors.textLight} />
          {activeFilters ? <AppText color="#fff" weight="700">{activeFilters}</AppText> : null}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {REPORTS.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setActive(r.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
              borderRadius: radius.pill, backgroundColor: active === r.id ? colors.primary : colors.card,
              borderWidth: 1, borderColor: active === r.id ? colors.primary : colors.border,
            }}
          >
            <MaterialCommunityIcons name={r.icon as any} size={15} color={active === r.id ? '#fff' : colors.textLight} />
            <AppText weight="700" color={active === r.id ? '#fff' : colors.text}>{r.label}</AppText>
          </Pressable>
        ))}
      </ScrollView>

      {report.empty ? (
        <EmptyState icon="chart-box-outline" title="No data" description="Try widening the date range or clearing the farm filter." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {report.tiles.map((t) => (
              <View key={t.label} style={{ width: '48%', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
                <AppText variant="caption" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.label}</AppText>
                <AppText weight="800" style={{ fontSize: 17, marginTop: 4 }} numberOfLines={1}>{t.value}</AppText>
              </View>
            ))}
          </View>

          {report.chart ? (
            <>
              <SectionTitle>{report.chartTitle}</SectionTitle>
              <Card>
                <ScreenScrollHost>
                  <Bars labels={report.chart.labels} datasets={report.chart.datasets} />
                </ScreenScrollHost>
              </Card>
            </>
          ) : null}

          <SectionTitle>Detail</SectionTitle>
          <Card style={{ padding: 0 }}>
            {report.rows.map((row, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
              >
                <AppText style={{ flex: 1 }} numberOfLines={1}>{row.label}</AppText>
                <AppText weight="700" style={{ textAlign: 'right' }}>{row.value}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}

      <View style={{ height: spacing.xxl }} />

      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Report Filters">
        <SelectField
          label="Farm"
          value={filters.farm}
          onChangeValue={(v) => setFilters((f) => ({ ...f, farm: v }))}
          options={(d.farms || []).map((f: any) => ({ value: f.id, label: f.name }))}
          placeholder="All Farms"
        />
      </Sheet>
    </Screen>
  );
}

type Built = {
  empty: boolean;
  tiles: { label: string; value: string }[];
  chartTitle: string;
  chart: { labels: string[]; datasets: { label: string; data: number[]; color?: string }[] } | null;
  rows: { label: string; value: string }[];
};

function build(id: ReportId, f: any): Built {
  if (id === 'production') {
    const map: Record<string, any> = {};
    const get = (nm: string) => (map[nm] ||= { crop: nm, area: 0, expected: 0, harvested: 0 });
    f.cycles.forEach((c: any) => {
      const r = get(c.crops?.name || 'Unknown');
      if (!['Planned', 'Cancelled'].includes(c.status)) r.area += n(c.area_planted);
      r.expected += n(c.expected_production);
    });
    f.harvests.forEach((h: any) => { get(h.crops?.name || h.crop_cycles?.crops?.name || 'Unknown').harvested += n(h.quantity); });
    const rows = Object.values(map).sort((a: any, b: any) => b.harvested - a.harvested);
    const tot = rows.reduce((s: any, r: any) => ({ area: s.area + r.area, expected: s.expected + r.expected, harvested: s.harvested + r.harvested }), { area: 0, expected: 0, harvested: 0 });
    return {
      empty: rows.length === 0,
      tiles: [
        { label: 'Planted Area', value: `${round1(tot.area)} ha` },
        { label: 'Expected', value: `${formatNumber(Math.round(tot.expected))} kg` },
        { label: 'Harvested', value: `${formatNumber(Math.round(tot.harvested))} kg` },
        { label: 'Achievement', value: tot.expected ? `${Math.round((tot.harvested / tot.expected) * 100)}%` : '—' },
      ],
      chartTitle: 'Expected vs Harvested',
      chart: {
        labels: rows.map((r: any) => r.crop),
        datasets: [
          { label: 'Expected', data: rows.map((r: any) => Math.round(r.expected)), color: '#1976D2' },
          { label: 'Harvested', data: rows.map((r: any) => Math.round(r.harvested)), color: '#2E7D32' },
        ],
      },
      rows: rows.map((r: any) => ({ label: r.crop, value: `${formatNumber(Math.round(r.harvested))} kg` })),
    };
  }

  if (id === 'yield') {
    const map: Record<string, any> = {};
    const get = (nm: string) => (map[nm] ||= { crop: nm, area: 0, qty: 0 });
    f.harvests.forEach((h: any) => {
      const r = get(h.crops?.name || h.crop_cycles?.crops?.name || 'Unknown');
      r.area += n(h.harvested_area);
      r.qty += n(h.quantity);
    });
    const rows = Object.values(map).map((r: any) => ({ ...r, yield: r.area > 0 ? r.qty / r.area : 0 })).sort((a: any, b: any) => b.yield - a.yield);
    const totQty = rows.reduce((s: number, r: any) => s + r.qty, 0);
    const totArea = rows.reduce((s: number, r: any) => s + r.area, 0);
    return {
      empty: rows.length === 0,
      tiles: [
        { label: 'Total Harvested', value: `${formatNumber(Math.round(totQty))} kg` },
        { label: 'Harvested Area', value: `${round1(totArea)} ha` },
        { label: 'Overall Yield', value: totArea ? `${formatNumber(Math.round(totQty / totArea))} kg/ha` : '—' },
        { label: 'Records', value: String(f.harvests.length) },
      ],
      chartTitle: 'Yield by Crop (kg/ha)',
      chart: { labels: rows.map((r: any) => r.crop), datasets: [{ label: 'kg/ha', data: rows.map((r: any) => Math.round(r.yield)) }] },
      rows: rows.map((r: any) => ({ label: r.crop, value: r.yield ? `${formatNumber(Math.round(r.yield))} kg/ha` : '—' })),
    };
  }

  // financial
  const byMonth: Record<string, any> = {};
  const m = (k: string) => (byMonth[k] ||= { month: k, revenue: 0, expenses: 0 });
  f.sales.forEach((s: any) => { if (s.sale_date) m(s.sale_date.substring(0, 7)).revenue += n(s.total_amount); });
  f.expenses.forEach((e: any) => { if (e.expense_date) m(e.expense_date.substring(0, 7)).expenses += n(e.amount); });
  const months = Object.values(byMonth).sort((a: any, b: any) => a.month.localeCompare(b.month));
  const totRev = f.sales.reduce((s: number, x: any) => s + n(x.total_amount), 0);
  const totExp = f.expenses.reduce((s: number, x: any) => s + n(x.amount), 0);
  return {
    empty: months.length === 0,
    tiles: [
      { label: 'Total Revenue', value: formatCurrency(totRev) },
      { label: 'Total Expenses', value: formatCurrency(totExp) },
      { label: 'Net Profit', value: formatCurrency(totRev - totExp) },
      { label: 'Margin', value: totRev ? `${Math.round(((totRev - totExp) / totRev) * 100)}%` : '—' },
    ],
    chartTitle: 'Revenue vs Expenses',
    chart: {
      labels: months.map((r: any) => monthLabel(r.month)),
      datasets: [
        { label: 'Revenue', data: months.map((r: any) => Math.round(r.revenue)), color: '#2E7D32' },
        { label: 'Expenses', data: months.map((r: any) => Math.round(r.expenses)), color: '#D32F2F' },
      ],
    },
    rows: months.map((r: any) => ({ label: monthLabel(r.month), value: formatCurrency(r.revenue - r.expenses) })),
  };
}

const monthLabel = (key: string) => {
  const [y, mm] = key.split('-');
  return new Date(Number(y), Number(mm) - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};
