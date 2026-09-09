import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDashboard, useProfile } from '../lib/useResource';
import { computeDashboard, DashFilters } from '../features/dashboard/aggregate';
import { formatCurrency, formatDate, formatNumber, getGreeting } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText, Card, EmptyState, Loading, ScreenScrollHost, SectionTitle } from '../components/ui';
import { Screen } from '../components/ui';
import { Bars, Donut, LineChart } from '../components/charts';
import { SelectField } from '../components/fields';
import { Sheet } from '../components/Sheet';

export function DashboardScreen({ navigation }: any) {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();
  const { profile } = useProfile();
  const { colors } = useTheme();
  const [filters, setFilters] = useState<DashFilters>({ farm: '', season: '', from: '', to: '' });
  const [filterOpen, setFilterOpen] = useState(false);

  const d = data || {};
  const agg = useMemo(() => computeDashboard(d, filters), [d, filters]);

  if (isLoading) return <Loading label="Loading dashboard…" />;
  if (isError) {
    return <EmptyState icon="alert" title="Dashboard error" description="Could not load dashboard data." actionLabel="Retry" onAction={refetch} />;
  }

  const activeFilters = [filters.farm, filters.season, filters.from, filters.to].filter(Boolean).length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{getGreeting()}, {profile?.full_name || 'Farmer'}</AppText>
          <AppText variant="subtitle">Here's what's happening across your farm.</AppText>
        </View>
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

      {/* KPI grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
        {agg.kpis.map((k) => (
          <Pressable
            key={k.label}
            onPress={() => k.link && navigation.navigate(k.link)}
            style={{
              width: '48%', backgroundColor: colors.card, borderRadius: radius.md,
              borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4,
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name={k.icon as any} size={18} color={colors.primary} />
            </View>
            <AppText variant="caption">{k.label}</AppText>
            <AppText weight="800" style={{ fontSize: 17 }}>{k.value}</AppText>
          </Pressable>
        ))}
      </View>

      {/* Land utilization */}
      <SectionTitle>Land Utilization</SectionTitle>
      <Card>
        <AppText weight="800" style={{ fontSize: 28, textAlign: 'center' }}>{agg.land.pct}%</AppText>
        <AppText variant="caption" style={{ textAlign: 'center', marginBottom: spacing.md }}>Utilization rate</AppText>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: 'hidden' }}>
          <View style={{ width: `${agg.land.pct}%`, height: '100%', backgroundColor: colors.primary }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <AppText variant="caption">{agg.land.planted.toFixed(1)} ha planted</AppText>
          <AppText variant="caption">{agg.land.total.toFixed(1)} ha total</AppText>
        </View>
      </Card>

      {agg.cycleStatus.length ? (
        <>
          <SectionTitle>Cycle Status</SectionTitle>
          <Card><Donut data={agg.cycleStatus} /></Card>
        </>
      ) : null}

      {agg.harvestByCrop.labels.length ? (
        <>
          <SectionTitle>Harvest by Crop</SectionTitle>
          <Card>
            <ScreenScrollHost>
              <Bars labels={agg.harvestByCrop.labels} datasets={[{ label: 'kg', data: agg.harvestByCrop.values, color: colors.primary }]} />
            </ScreenScrollHost>
          </Card>
        </>
      ) : null}

      {agg.trend.labels.length ? (
        <>
          <SectionTitle>Production Trend</SectionTitle>
          <Card>
            <ScreenScrollHost>
              <LineChart labels={agg.trend.labels} data={agg.trend.values} />
            </ScreenScrollHost>
          </Card>
        </>
      ) : null}

      {/* Finance */}
      <SectionTitle>Revenue vs Expenses</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md }}>
          <AppText variant="caption" color={colors.green}>▲ {formatCurrency(agg.finance.totalSales)} revenue</AppText>
          <AppText variant="caption" color={colors.red}>▼ {formatCurrency(agg.finance.totalExpenses)} expenses</AppText>
          <AppText variant="caption" color={colors.blue}>
            Net {formatCurrency(agg.finance.totalSales - agg.finance.totalExpenses)}
          </AppText>
        </View>
        {agg.finance.labels.length ? (
          <ScreenScrollHost>
            <Bars
              labels={agg.finance.labels}
              datasets={[
                { label: 'Revenue', data: agg.finance.sales, color: '#2E7D32' },
                { label: 'Expenses', data: agg.finance.expenses, color: '#D32F2F' },
              ]}
            />
          </ScreenScrollHost>
        ) : (
          <AppText variant="caption">No financial data yet</AppText>
        )}
      </Card>

      {agg.expenseBreakdown.length ? (
        <>
          <SectionTitle>Expense Breakdown</SectionTitle>
          <Card><Donut data={agg.expenseBreakdown} /></Card>
        </>
      ) : null}

      {/* Harvest analytics */}
      <SectionTitle>Harvest Analytics</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Tile label="Total Harvested" value={`${formatNumber(Math.round(agg.harvest.totalQty))} kg`} />
        <Tile label="Avg Yield" value={`${agg.harvest.avgYield.toFixed(0)} kg/ha`} />
        <Tile label="Records" value={String(agg.harvest.count)} />
        <Tile label="Out of Stock" value={String(agg.invHealth.out)} />
      </View>

      {/* Alerts */}
      <SectionTitle>Alerts</SectionTitle>
      {agg.alerts.length === 0 ? (
        <Card><AppText variant="caption" style={{ textAlign: 'center' }}>All clear — no alerts</AppText></Card>
      ) : (
        agg.alerts.map((a, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md,
              backgroundColor: colors.card, borderLeftWidth: 3, marginBottom: spacing.sm,
              borderLeftColor: a.tone === 'danger' ? colors.red : a.tone === 'warning' ? colors.orange : colors.blue,
              borderWidth: 1, borderColor: colors.border,
            }}
          >
            <MaterialCommunityIcons
              name={a.icon as any}
              size={18}
              color={a.tone === 'danger' ? colors.red : a.tone === 'warning' ? colors.orange : colors.blue}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" weight="700">{a.title}</AppText>
              <AppText variant="caption">{a.msg}</AppText>
            </View>
          </View>
        ))
      )}

      {/* Upcoming */}
      {agg.upcoming.length ? (
        <>
          <SectionTitle>Upcoming Harvests</SectionTitle>
          <Card style={{ padding: 0 }}>
            {agg.upcoming.map((c: any, i: number) => (
              <View
                key={c.id}
                style={{
                  flexDirection: 'row', gap: spacing.md, padding: spacing.md,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                }}
              >
                <View style={{ alignItems: 'center', minWidth: 42 }}>
                  <AppText weight="800">{new Date(c.expected_harvest_date).getDate()}</AppText>
                  <AppText variant="caption">{new Date(c.expected_harvest_date).toLocaleString('en', { month: 'short' })}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="600">{c.crops?.name || 'Crop'}</AppText>
                  <AppText variant="caption">{c.farms?.name || ''} / {c.fields?.name || ''}</AppText>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <View style={{ height: spacing.xxl }} />

      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Dashboard Filters">
        <SelectField
          label="Farm"
          value={filters.farm}
          onChangeValue={(v) => setFilters((f) => ({ ...f, farm: v }))}
          options={(d.farms || []).map((f: any) => ({ value: f.id, label: f.name }))}
          placeholder="All Farms"
        />
        <SelectField
          label="Season"
          value={filters.season}
          onChangeValue={(v) => setFilters((f) => ({ ...f, season: v }))}
          options={(d.seasons || []).map((s: any) => ({ value: s.id, label: s.name }))}
          placeholder="All Seasons"
        />
      </Sheet>
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '48%', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
      <AppText variant="caption" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</AppText>
      <AppText weight="800" style={{ fontSize: 18, marginTop: 4 }}>{value}</AppText>
    </View>
  );
}
