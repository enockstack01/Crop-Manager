import React from 'react';
import { RefreshControl, View } from 'react-native';
import { useDashboard } from '../lib/useResource';
import { formatDate } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/theme';
import { AppText, Card, EmptyState, Loading, Screen } from '../components/ui';

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
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />}>
      <AppText variant="subtitle">Upcoming farm events.</AppText>
      {events.length === 0 ? (
        <EmptyState icon="calendar-check" title="No upcoming events" description="Expected harvest dates from your active crop cycles will appear here." />
      ) : (
        <Card style={{ padding: 0, marginTop: spacing.md }}>
          {events.map((e, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
            >
              <View style={{ alignItems: 'center', minWidth: 44 }}>
                <AppText weight="800" style={{ fontSize: 18 }}>{new Date(e.date).getDate()}</AppText>
                <AppText variant="caption">{new Date(e.date).toLocaleString('en', { month: 'short' })}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="600">{e.title}</AppText>
                <AppText variant="caption">{e.meta} · {formatDate(e.date)}</AppText>
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
