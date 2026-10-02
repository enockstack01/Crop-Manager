import React, { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useDashboard, useProfile } from '../lib/useResource';
import { computeDashboard, DashFilters } from '../features/dashboard/aggregate';
import { displayName, formatCurrency, formatDate, formatNumber, getGreeting } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import {
  AppText,
  ChartCard,
  EmptyState,
  Grid,
  PageHeader,
  Screen,
  Skeleton,
  StatTile,
  useLayout,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { Bars, Donut, LineChart } from '../components/charts';
import { DateField, SelectField } from '../components/fields';
import { FarmProfileCard } from '../features/dashboard/FarmProfileCard';

/*
 * Mirrors the web dashboard (client/src/pages/Dashboard.jsx): same greeting, farm
 * profile, filters, chart cards, analytics tiles, activity/events/alerts — in the
 * same order and with the same figures (computeDashboard is a port of the web's).
 */
export function DashboardScreen({ navigation }: any) {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard();
  const { profile } = useProfile();
  const { colors, isDark } = useTheme();
  const { isWide } = useLayout();
  const [filters, setFilters] = useState<DashFilters>({ farm: '', season: '', from: '', to: '', currency: '' });

  const d = data || {};
  const agg = useMemo(() => computeDashboard(d, filters), [d, filters]);

  if (isLoading) return <DashboardSkeleton />;
  if (isError) {
    return (
      <EmptyState
        icon={(error as any)?.network ? 'cloud-off-outline' : 'triangle-exclamation'}
        title="Dashboard Error"
        description={(error as any)?.message || 'Could not load dashboard data.'}
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  const set = (k: keyof DashFilters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const pairCols = isWide ? 2 : 1; // web .chart-grid: 2 columns, 1 below 1024px
  const tint = (light: string, dark: string) => (isDark ? dark : light);

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title={`${getGreeting()}, ${displayName(profile)}`} subtitle="Here's what's happening across your farm today." />

      {/* the homepage opens with the farm profile + land utilization */}
      <View style={{ marginBottom: 20 }}>
        <FarmProfileCard
          farms={d.farms || []}
          fields={d.fields || []}
          selected={filters.farm}
          onSelect={set('farm')}
          kpis={agg.kpis}
          onKpiPress={(link) => navigation.navigate(link)}
        />
      </View>

      {/* .dashboard-filters */}
      <Grid columns={2} gap={10} style={{ marginBottom: 20 }}>
        <SelectField value={filters.farm} onChangeValue={set('farm')} placeholder="All Farms" options={(d.farms || []).map((f: any) => ({ value: f.id, label: f.name }))} />
        <SelectField value={filters.season} onChangeValue={set('season')} placeholder="All Seasons" options={(d.seasons || []).map((s: any) => ({ value: s.id, label: s.name }))} />
        <DateField value={filters.from} onChangeValue={set('from')} />
        <DateField value={filters.to} onChangeValue={set('to')} />
        {agg.currencies.length > 1 ? (
          <SelectField
            value={filters.currency || ''}
            onChangeValue={set('currency')}
            placeholder={`All currencies (charts in ${agg.chartCurrency})`}
            options={agg.currencies.map((c: string) => ({ value: c, label: `Only ${c}` }))}
          />
        ) : null}
      </Grid>


      <View style={{ gap: 20 }}>
        <Grid columns={1} gap={20}>
          <ChartCard title="Crop Distribution" icon="chart-pie">
            <Donut data={agg.cropDist} emptyLabel="No planted crops to display" />
          </ChartCard>
        </Grid>

        <Grid columns={pairCols} gap={20}>
          <ChartCard title="Cycle Status" icon="rotate">
            <Donut data={agg.cycleStatus} />
          </ChartCard>
          <ChartCard title="Harvest by Crop" icon="chart-column" iconColor={colors.blue}>
            <Bars labels={agg.harvestByCrop.labels} datasets={[{ label: 'Quantity (kg)', data: agg.harvestByCrop.values }]} colorEach emptyLabel="No harvest data" />
          </ChartCard>
        </Grid>

        <ChartCard title="Production Trend" icon="chart-line">
          <LineChart labels={agg.trend.labels} data={agg.trend.values} label="Harvest (kg)" emptyLabel="No harvest data for trend" />
        </ChartCard>

        <Grid columns={pairCols} gap={20}>
          <ChartCard title="Crop Performance" icon="seedling">
            <Bars labels={agg.cropPerf.labels} datasets={[{ label: 'Area (ha)', data: agg.cropPerf.values }]} colorEach />
          </ChartCard>
          <ChartCard title="Harvest Analytics" icon="wheat-awn" iconColor={colors.orange}>
            <Grid columns={2} gap={spacing.lg}>
              <StatTile label="Total Harvested" value={formatNumber(Math.round(agg.harvest.totalQty))} sub="kg" />
              <StatTile label="Avg Yield" value={agg.harvest.avgYield.toFixed(0)} sub="kg/ha" color={colors.primary} />
              <StatTile label="Harvest Records" value={agg.harvest.count} sub="records" color={colors.blue} />
              <StatTile label="Harvest Costs" value={agg.harvest.costText} sub="total" color={colors.red} />
            </Grid>
          </ChartCard>
        </Grid>

        <ChartCard
          title={`Revenue vs Expenses · ${agg.chartCurrency}`}
          icon="chart-area"
          right={
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', marginTop: 4 }}>
              <AppText weight="600" style={{ fontSize: 12, color: colors.green }}>
                <Icon name="arrow-up" size={10} color={colors.green} /> {formatCurrency(agg.finance.totalSales, agg.chartCurrency)} Revenue
              </AppText>
              <AppText weight="600" style={{ fontSize: 12, color: colors.red }}>
                <Icon name="arrow-down" size={10} color={colors.red} /> {formatCurrency(agg.finance.totalExpenses, agg.chartCurrency)} Expenses
              </AppText>
              <AppText weight="600" style={{ fontSize: 12, color: colors.blue }}>
                Net: {formatCurrency(agg.finance.totalSales - agg.finance.totalExpenses, agg.chartCurrency)}
              </AppText>
            </View>
          }
        >
          <Bars
            labels={agg.finance.labels}
            datasets={[
              { label: 'Revenue', data: agg.finance.sales, color: 'rgba(46,125,50,0.75)' },
              { label: 'Expenses', data: agg.finance.expenses, color: 'rgba(211,47,47,0.75)' },
            ]}
            emptyLabel="No financial data yet"
          />
        </ChartCard>

        <Grid columns={pairCols} gap={20}>
          <ChartCard title={`Expense Breakdown · ${agg.chartCurrency}`} icon="receipt" iconColor={colors.red}>
            <Donut data={agg.expenseBreakdown} emptyLabel="No expense data" />
          </ChartCard>
          <ChartCard title={`Sales Analytics · ${agg.chartCurrency}`} icon="hand-holding-dollar" iconColor={colors.green}>
            <Grid columns={isWide ? 3 : 1} gap={12}>
              <StatTile tone="green" label="Paid" value={formatCurrency(agg.salesByStatus.Paid, agg.chartCurrency)} color="#2E7D32" />
              <StatTile tone="orange" label="Pending" value={formatCurrency(agg.salesByStatus.Pending, agg.chartCurrency)} color="#F57F17" />
              <StatTile tone="blue" label="Partial" value={formatCurrency(agg.salesByStatus['Partially Paid'], agg.chartCurrency)} color="#1565C0" />
            </Grid>
            <View style={{ marginTop: 16 }}>
              <StatTile label="Total Sales" value={formatCurrency(agg.finance.totalSales, agg.chartCurrency)} sub={`${agg.salesInCurrency} records`} />
            </View>
          </ChartCard>
        </Grid>

        <Grid columns={pairCols} gap={20}>
          <ChartCard title="Inventory Health" icon="boxes-stacked" iconColor={colors.blue}>
            {(d.inventory || []).length === 0 ? (
              <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No inventory items yet</AppText>
            ) : (
              <Grid columns={2} gap={12}>
                <StatTile label="Healthy Stock" value={agg.inv.healthy} color="#2E7D32" />
                <StatTile label="Low Stock" value={agg.inv.low} color="#F57F17" />
                <StatTile label="Out of Stock" value={agg.inv.out} color="#D32F2F" />
                <StatTile label="Expiring Soon" value={agg.inv.expiring} color="#1565C0" />
              </Grid>
            )}
          </ChartCard>
          <ChartCard title="Crop Health" icon="heart-pulse" iconColor={colors.red}>
            {(d.scouting || []).length === 0 ? (
              <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No scouting data</AppText>
            ) : (
              <Grid columns={3} gap={10}>
                <StatTile label="Healthy" value={agg.health.healthy} color="#2E7D32" />
                <StatTile label="Observed" value={agg.health.observed} color="#F57F17" />
                <StatTile label="At Risk" value={agg.health.atRisk} color="#D32F2F" />
              </Grid>
            )}
          </ChartCard>
        </Grid>

        <Grid columns={pairCols} gap={20}>
          <ChartCard title="Recent Activities" icon="clock" iconColor={colors.purple}>
            {(d.activities || []).length === 0 ? (
              <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No recent activities</AppText>
            ) : (
              <View style={{ paddingLeft: 24 }}>
                <View style={{ position: 'absolute', left: 8, top: 4, bottom: 4, width: 2, backgroundColor: colors.border }} />
                {(d.activities || []).slice(0, 8).map((a: any, i: number, arr: any[]) => (
                  <View key={a.id} style={{ paddingBottom: i === arr.length - 1 ? 0 : 20 }}>
                    <View
                      style={{
                        position: 'absolute', left: -20, top: 4, width: 14, height: 14, borderRadius: 7,
                        backgroundColor: colors.primaryLight, borderWidth: 2, borderColor: colors.primary,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                    </View>
                    <AppText style={{ fontSize: 13, lineHeight: 19 }}>
                      <AppText weight="600" style={{ fontSize: 13 }}>{a.activity_type}</AppText> — {a.description || 'No description'}
                    </AppText>
                    <AppText variant="caption" style={{ marginTop: 3 }}>
                      {a.farms?.name || ''} {a.fields?.name ? `/ ${a.fields.name}` : ''} · {formatDate(a.activity_date)}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </ChartCard>

          <ChartCard title="Upcoming Events" icon="calendar-check" iconColor={colors.blue}>
            {agg.upcoming.length === 0 ? (
              <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No upcoming events</AppText>
            ) : (
              agg.upcoming.map((c: any, i: number) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                    borderBottomWidth: i === agg.upcoming.length - 1 ? 0 : 1, borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <AppText weight="700" style={{ fontSize: 16, lineHeight: 18, color: colors.primary }}>{new Date(c.expected_harvest_date).getDate()}</AppText>
                    <AppText weight="600" style={{ fontSize: 9, lineHeight: 11, color: colors.primary, textTransform: 'uppercase', opacity: 0.7 }}>
                      {new Date(c.expected_harvest_date).toLocaleString('en', { month: 'short' })}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="600" style={{ fontSize: 13 }}>{c.crops?.name || 'Crop'} harvest</AppText>
                    <AppText variant="caption" style={{ marginTop: 2 }}>{c.farms?.name || ''}{c.fields?.name ? ` / ${c.fields.name}` : ''}</AppText>
                  </View>
                </View>
              ))
            )}
          </ChartCard>
        </Grid>

        <ChartCard title="Alerts" icon="bell" iconColor={colors.orange}>
          {agg.alerts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Icon name="circle-check" size={24} color={colors.primary} />
              <AppText variant="subtitle" style={{ fontSize: 13, marginTop: 8 }}>All clear — no alerts</AppText>
            </View>
          ) : (
            agg.alerts.map((a, i) => {
              const c = a.tone === 'danger'
                ? { bg: tint('#FFEBEE', '#3D1A1A'), bar: '#D32F2F', txt: '#D32F2F' }
                : a.tone === 'warning'
                  ? { bg: tint('#FFF8E1', '#3D3420'), bar: '#F9A825', txt: '#F57F17' }
                  : { bg: tint('#E3F2FD', '#1A3A5C'), bar: '#1976D2', txt: '#1565C0' };
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md,
                    backgroundColor: c.bg, borderLeftWidth: 3, borderLeftColor: c.bar, marginBottom: i === agg.alerts.length - 1 ? 0 : 8,
                  }}
                >
                  <Icon name={a.icon} size={14} color={c.bar} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="600" style={{ fontSize: 10, letterSpacing: 0.5, color: c.txt, marginBottom: 2 }}>{a.title}</AppText>
                    <AppText style={{ fontSize: 13 }}>{a.msg}</AppText>
                  </View>
                </View>
              );
            })
          )}
        </ChartCard>
      </View>
    </Screen>
  );
}

/** Layout-shaped placeholder shown while the dashboard loads. */
function DashboardSkeleton() {
  const { colors } = useTheme();
  const { columns } = useLayout();
  const box = { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border };
  return (
    <Screen>
      <Skeleton width="75%" height={24} />
      <Skeleton width="60%" height={13} style={{ marginTop: 10, marginBottom: 20 }} />
      <Grid columns={columns} gap={spacing.lg}>
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={[box, { flexDirection: 'row', gap: 14 }]}>
            <Skeleton width={44} height={44} radius={10} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="50%" height={11} />
              <Skeleton width="70%" height={20} />
            </View>
          </View>
        ))}
      </Grid>
      <View style={[box, { marginTop: 24, height: 220, gap: 12 }]}>
        <Skeleton width="45%" height={14} />
        <Skeleton height={150} radius={radius.md} />
      </View>
    </Screen>
  );
}
