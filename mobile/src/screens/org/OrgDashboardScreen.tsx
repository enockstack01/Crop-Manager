import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, ChartCard, EmptyState, Grid, Loading, PageHeader, Screen, StatTile, useLayout } from '../../components/ui';
import { Bars, HBars } from '../../components/charts';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/fields';
import { formatDate, formatNumber } from '../../lib/format';
import { useOrgDashboard } from '../../lib/orgApi';
import { OrgGate, UsageMeter } from './OrgGate';
import { t } from '../../i18n';

const ha = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} ha`;
const kg = (v: number) => (v >= 1000 ? `${(Math.round(v / 100) / 10).toLocaleString('en-US')} t` : `${Math.round(v).toLocaleString('en-US')} kg`);
const STAGES = [
  { key: 'Planned', label: 'Planned', color: '#5B6B5D' },
  { key: 'Planted', label: 'Planted', color: '#1B5E20' },
  { key: 'Growing', label: 'Growing', color: '#2E7D32' },
  { key: 'Ready for Harvest', label: 'Ready to harvest', color: '#F9A825' },
];

function Body({ org, navigation }: { org: any; navigation: any }) {
  const { colors } = useTheme();
  const { isTablet } = useLayout();
  const [district, setDistrict] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const { data: d, isLoading, isError, refetch } = useOrgDashboard(org.id, district ? { district } : {});

  React.useEffect(() => {
    if (d && !district) setDistricts(d.land.by_district.map((x: any) => x.district).filter((x: string) => x && x !== '—'));
  }, [d, district]);

  if (isLoading) return <Loading label="Loading dashboard..." />;
  if (isError || !d) return <EmptyState icon="triangle-exclamation" title="Could not load the dashboard" actionLabel="Retry" onAction={() => refetch()} />;
  const o = d.overview;
  const cols = isTablet ? 4 : 2;

  return (
    <>
      <PageHeader title={org.name} subtitle="A summary of the crop activity on your farmers' farms." />
      {districts.length > 0 ? (
        <SelectField label="District" value={district} onChangeValue={setDistrict} options={[{ value: '', label: t('All districts') }, ...districts.map((x) => ({ value: x, label: x }))]} placeholder="" />
      ) : null}

      <Grid columns={cols} gap={12}>
        <StatTile label="Farmers" value={formatNumber(o.farmers)} />
        <StatTile label="New this month" value={formatNumber(o.new_this_month)} />
        <StatTile label="Active farmers" value={formatNumber(o.active_farmers)} sub={`${o.farmers ? Math.round((o.active_farmers / o.farmers) * 100) : 0}%`} />
        <StatTile label="Farms" value={formatNumber(d.land.farms)} />
      </Grid>

      <View style={{ height: 16 }} />
      <ChartCard title="Farmer limit" icon="gauge">
        <UsageMeter count={o.usage.count} max={o.usage.max} />
      </ChartCard>

      <View style={{ height: 16 }} />
      <ChartCard title="Farms and land" icon="map-location-dot">
        <Grid columns={2} gap={12}>
          <StatTile label="Total area" value={ha(d.land.total_ha)} />
          <StatTile label="Average farm size" value={ha(d.land.avg_ha)} />
        </Grid>
        <View style={{ height: 12 }} />
        <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{t('Land by district')}</AppText>
        {d.land.by_district.length ? (
          <HBars data={d.land.by_district.slice(0, 8).map((x: any) => ({ label: x.district, value: Math.round(x.ha * 10) / 10 }))} unit=" ha" />
        ) : <AppText variant="subtitle" style={{ fontSize: 13 }}>{t('No farms recorded yet.')}</AppText>}
      </ChartCard>

      <View style={{ height: 16 }} />
      <ChartCard title="Crops" icon="seedling">
        {d.crops.length ? (
          <View style={{ gap: 14 }}>
            <HBars data={d.crops.slice(0, 8).map((c: any) => ({ label: c.name, value: Math.round(c.area_ha * 10) / 10 }))} unit=" ha" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {STAGES.map((st, i) => (
                <View key={st.key} style={{ flexBasis: '47%', flexGrow: 1, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, opacity: d.stages[st.key] ? 1 : 0.55 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: st.color, alignItems: 'center', justifyContent: 'center' }}>
                    <AppText weight="700" style={{ fontSize: 11, color: st.key === 'Ready for Harvest' ? '#1C2B1E' : '#FFFFFF' }}>{i + 1}</AppText>
                  </View>
                  <AppText weight="800" style={{ fontSize: 26, marginTop: 6 }}>{d.stages[st.key]}</AppText>
                  <AppText weight="700" style={{ fontSize: 12, color: colors.primaryDark }}>{t(st.label)}</AppText>
                </View>
              ))}
            </View>
            {d.crops.map((c: any) => (
              <View key={c.name} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <AppText weight="700" style={{ fontSize: 13 }}>{c.name}</AppText>
                <AppText style={{ fontSize: 12, color: colors.textLight }}>
                  {t(c.farmers === 1 ? '{{count}} farmer' : '{{count}} farmers', { count: c.farmers })} · {ha(c.area_ha)} · {t('Expected harvest')}: {c.expected_kg ? kg(c.expected_kg) : '—'} · {t('Recorded harvest')}: {c.harvested_kg ? kg(c.harvested_kg) : '—'}
                </AppText>
              </View>
            ))}
          </View>
        ) : <AppText variant="subtitle" style={{ fontSize: 13 }}>{t('No open crop cycles yet.')}</AppText>}
      </ChartCard>

      <View style={{ height: 16 }} />
      <ChartCard title="Activity" icon="tractor">
        <Bars labels={d.activity.weekly.map((w: any) => formatDate(w.week).slice(0, 5))} datasets={[{ label: 'Activities', data: d.activity.weekly.map((w: any) => w.count) }]} height={200} />
        <View style={{ height: 12 }} />
        {d.activity.recent.map((a: any, i: number) => (
          <AppText key={i} style={{ fontSize: 13, paddingVertical: 4 }}>
            <AppText weight="700" style={{ fontSize: 13 }}>{a.farmer}</AppText> · {t(a.type || 'Other')} <AppText style={{ fontSize: 12, color: colors.textLight }}>{formatDate(a.date)}</AppText>
          </AppText>
        ))}
      </ChartCard>

      <View style={{ height: 16 }} />
      <ChartCard title="Alerts" icon="bell">
        <View style={{ gap: 14 }}>
          <View>
            <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t('No recent activity')} · {d.alerts.inactive_count}</AppText>
            {d.alerts.inactive.map((a: any) => (
              <AppText key={a.farmer_id} style={{ fontSize: 13, paddingVertical: 2 }}>{a.farmer} <AppText style={{ fontSize: 12, color: colors.textLight }}>{a.last_activity ? formatDate(a.last_activity) : t('never')}</AppText></AppText>
            ))}
            {d.alerts.inactive_count > 0 ? <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Button title="See farmers" size="sm" kind="secondary" onPress={() => navigation.navigate('org-farmers', { inactive: '1' })} /></View> : null}
          </View>
          <View>
            <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t('Pest and disease reports')} · {d.alerts.reports_count}</AppText>
            {d.alerts.reports.map((r: any, i: number) => (
              <AppText key={i} style={{ fontSize: 13, paddingVertical: 2 }}>{r.farmer} · {t(r.kind)}{r.crop ? ` · ${r.crop}` : ''}{'\n'}<AppText style={{ fontSize: 12, color: colors.textLight }}>{r.note} · {formatDate(r.date)}</AppText></AppText>
            ))}
            {!d.alerts.reports.length ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('None in the last 14 days')}</AppText> : null}
          </View>
          <View>
            <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t('Harvest overdue')} · {d.alerts.overdue_count}</AppText>
            {d.alerts.overdue.map((c: any, i: number) => (
              <AppText key={i} style={{ fontSize: 13, paddingVertical: 2 }}>{c.farmer} · {c.crop} <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('due {{date}}', { date: formatDate(c.due) })}</AppText></AppText>
            ))}
            {!d.alerts.overdue.length ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Nothing overdue')}</AppText> : null}
          </View>
        </View>
      </ChartCard>
      <View style={{ height: 8 }} />
      <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Figures update every few minutes. Updated {{time}}.', { time: new Date(d.generated_at).toLocaleTimeString() })}</AppText>
    </>
  );
}

export function OrgDashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <Screen refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} tintColor={colors.primary} colors={[colors.primary]} />}>
      <OrgGate key={refreshKey}>{({ org }) => <Body org={org} navigation={navigation} />}</OrgGate>
    </Screen>
  );
}
