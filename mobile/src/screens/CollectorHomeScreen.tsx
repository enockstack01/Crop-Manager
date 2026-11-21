import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, ChartCard, EmptyState, Grid, Loading, PageHeader, Screen, StatTile } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { formatDate, formatNumber } from '../lib/format';
import { useCollectorDashboard, useTaskMutations } from '../lib/team';
import { agoParts } from '../lib/teamRules';
import { t } from '../i18n';

/*
 * The data collector's dashboard: today's entry count, a big button for each kind of field record, their open tasks, the fields that need a
 * check, and their own latest entries. Nothing about money, reports or the rest of the team.
 */
const BUTTON: Record<string, { route: string; icon: string; label: string }> = {
  'planting-records': { route: 'planting', icon: 'seedling', label: 'Planting' },
  'field-activities': { route: 'activities', icon: 'list-check', label: 'Field activity' },
  'irrigation-records': { route: 'irrigation', icon: 'droplet', label: 'Irrigation' },
  'fertilizer-applications': { route: 'fertilizers', icon: 'flask', label: 'Fertilizer' },
  'crop-protection-records': { route: 'crop-protection', icon: 'shield-halved', label: 'Crop protection' },
  'crop-scouting-records': { route: 'scouting', icon: 'magnifying-glass', label: 'Scouting' },
  'harvest-records': { route: 'harvest', icon: 'wheat-awn', label: 'Harvest' },
  greenhouse: { route: 'greenhouse', icon: 'warehouse', label: 'Greenhouse count' },
};

export function CollectorHomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const toast = useToast();
  const { data: d, isLoading, isError, refetch } = useCollectorDashboard();
  const { setStatus } = useTaskMutations();
  if (isLoading) return <Screen><Loading /></Screen>;
  if (isError || !d) return <Screen><EmptyState icon="triangle-exclamation" title="Could not load your day" actionLabel="Retry" onAction={() => refetch()} /></Screen>;
  const when = (iso?: string) => { const a = agoParts(iso); return a ? t(a.key, { n: a.n, date: a.date ? formatDate(a.date) : '' }) : ''; };
  const markDone = async (task: any) => {
    try { await setStatus.mutateAsync({ id: task.id, status: 'done' }); toast(t('Marked done')); } catch (e: any) { toast(e?.message || '', 'error'); }
  };

  return (
    <Screen>
      <PageHeader title="Today" subtitle={d.farm_manager ? t('You are recording for {{name}}.', { name: d.farm_manager }) : 'Record what you do in the field.'} />
      <Grid columns={3} gap={10}>
        <StatTile label="Today" value={formatNumber(d.today.entries)} sub={t('entries')} />
        <StatTile label="This week" value={formatNumber(d.week.entries)} sub={t('entries')} />
        <StatTile label="Open tasks" value={formatNumber(d.tasks.open)} sub={d.tasks.overdue ? `${d.tasks.overdue} ${t('late')}` : undefined} color={d.tasks.overdue ? colors.red : undefined} />
      </Grid>

      <View style={{ height: 16 }} />
      <ChartCard title="Record" icon="circle-plus">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {d.record.map((r: any) => {
            const b = BUTTON[r.path];
            if (!b) return null;
            return (
              <Pressable key={r.path} onPress={() => navigation.navigate(b.route, { add: true })} accessibilityRole="button" accessibilityLabel={t(b.label)} style={({ pressed }) => ({ width: '47%', minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.primaryLight : colors.card })}>
                <Icon name={b.icon} size={26} color={colors.primary} />
                <AppText weight="700" style={{ fontSize: 14, textAlign: 'center' }}>{t(b.label)}</AppText>
              </Pressable>
            );
          })}
        </View>
      </ChartCard>

      <View style={{ height: 16 }} />
      <ChartCard title="My open tasks" icon="list-check">
        {d.tasks.items.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Nothing to do right now.')}</AppText> : (
          <View style={{ gap: 12 }}>
            {d.tasks.items.map((task: any) => (
              <View key={task.id} style={{ gap: 4 }}>
                <AppText weight="700" style={{ fontSize: 14 }}>{task.title}</AppText>
                <AppText style={{ fontSize: 12, color: task.overdue ? colors.red : colors.textLight }}>{task.due_date ? `${task.overdue ? t('Late') : t('Due')} ${formatDate(task.due_date)} · ` : ''}{task.mine ? t('for you') : t('for everyone')}</AppText>
                <View style={{ alignSelf: 'flex-start' }}><Button title="Done" icon="check" size="sm" kind="secondary" loading={setStatus.isPending} onPress={() => markDone(task)} /></View>
              </View>
            ))}
          </View>
        )}
        <View style={{ alignSelf: 'flex-start', marginTop: 10 }}><Button title="All tasks" size="sm" kind="secondary" onPress={() => navigation.navigate('tasks')} /></View>
      </ChartCard>

      <View style={{ height: 16 }} />
      <ChartCard title="Fields that need a check" icon="magnifying-glass">
        {d.needs_check.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Every field was checked in the last week.')}</AppText> : (
          <View style={{ gap: 10 }}>
            {d.needs_check.map((f: any) => (
              <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="700" style={{ fontSize: 14 }}>{f.name}</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{f.last_checked ? `${t('last checked')} ${formatDate(f.last_checked)}` : t('never checked')}</AppText>
                </View>
                <Button title="Scout it" size="sm" kind="secondary" onPress={() => navigation.navigate('scouting', { add: true })} />
              </View>
            ))}
          </View>
        )}
      </ChartCard>

      <View style={{ height: 16 }} />
      <ChartCard title="My latest entries" icon="clock-rotate-left">
        {d.recent.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('You have not recorded anything yet.')}</AppText> : (
          <View style={{ gap: 10 }}>
            {d.recent.map((r: any) => (
              <View key={`${r.path}${r.id}`} style={{ gap: 2 }}>
                <AppText weight="700" style={{ fontSize: 14 }}>{t(r.kind)}</AppText>
                <AppText style={{ fontSize: 12, color: colors.textLight }}>{r.hint ? `${r.hint} · ` : ''}{r.date ? formatDate(r.date) : ''} · {when(r.created_at)}</AppText>
              </View>
            ))}
          </View>
        )}
      </ChartCard>
    </Screen>
  );
}
