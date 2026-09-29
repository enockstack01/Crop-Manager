import React from 'react';
import { RefreshControl, View } from 'react-native';
import { useDashboard } from '../lib/useResource';
import { formatDate } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow } from '../theme/theme';
import { AppText, EmptyState, Loading, PageHeader, Screen } from '../components/ui';

/** web Calendar page: page header + upcoming expected harvests in a card list. */
export function CalendarScreen() {
  const { data, isLoading, refetch, isFetching } = useDashboard();
  const { colors } = useTheme();

  const events: { date: string; title: string; meta: string }[] = [];
  for (const c of data?.cycles || []) {
    if (c.expected_harvest_date && ['Planned', 'Planted', 'Growing', 'Ready for Harvest'].includes(c.status)) {
      events.push({
        date: c.expected_harvest_date,
        title: `Expected harvest — ${c.crops?.name || ''}`,
        meta: `${c.farms?.name || ''} / ${c.fields?.name || ''}`,
      });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  if (isLoading) return <Loading />;

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Calendar" subtitle="Upcoming farm events." />
      {events.length === 0 ? (
        <EmptyState icon="calendar-check" title="No upcoming events" description="Expected harvest dates from your active crop cycles will appear here." />
      ) : (
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(1) }}>
          {events.map((e, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row', gap: 14, paddingVertical: 14, paddingHorizontal: 18,
                borderBottomWidth: i === events.length - 1 ? 0 : 1, borderBottomColor: colors.border,
              }}
            >
              <View style={{ minWidth: 54, alignItems: 'center' }}>
                <AppText weight="800" style={{ fontSize: 18, lineHeight: 22 }}>{new Date(e.date).getDate()}</AppText>
                <AppText style={{ fontSize: 11, color: colors.textLight }}>{new Date(e.date).toLocaleString('en', { month: 'short' })}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="600" style={{ fontSize: 14 }}>{e.title}</AppText>
                <AppText style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>{e.meta} · {formatDate(e.date)}</AppText>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
