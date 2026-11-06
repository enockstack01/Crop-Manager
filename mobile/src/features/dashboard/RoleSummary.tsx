import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatDate, formatNumber } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Badge, ChartCard } from '../../components/ui';
import { Button } from '../../components/Button';
import { t } from '../../i18n';

/*
 * The part of the home page that depends on the account type (mirrors client/src/features/dashboard/RoleSummary.jsx): what a farmer, farm
 * manager, agronomist or cooperative manager needs to look at first. One request (GET /dashboard/role); it sits above the common dashboard
 * and the dashboard still works without it.
 */
const useRoleSummary = () =>
  useQuery({ queryKey: ['dashboard', 'role'], queryFn: () => api.get('/dashboard/role').then((r) => r.data), staleTime: 60_000 });

type Row = { left: React.ReactNode; right?: string };

function Card({ icon, title, count, empty, rows, onOpen }: { icon: string; title: string; count: number; empty: string; rows: Row[]; onOpen?: () => void }) {
  const { colors } = useTheme();
  return (
    <ChartCard title={title} icon={icon} right={onOpen ? <Button title="Open" size="sm" kind="secondary" onPress={onOpen} /> : undefined}>
      {count === 0 ? (
        <AppText style={{ fontSize: 13, color: colors.textLight }}>{t(empty)}</AppText>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ alignSelf: 'flex-start' }}><Badge label={formatNumber(count)} tone="neutral" /></View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1 }}>{r.left}</View>
              {r.right ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{r.right}</AppText> : null}
            </View>
          ))}
        </View>
      )}
    </ChartCard>
  );
}

const TITLES: Record<string, [string, string]> = {
  Farmer: ['What needs your attention', 'This week on your farm.'],
  'Farm Manager': ['Running the farm', 'Work, stock, machines and spending at a glance.'],
  Agronomist: ['Crop health', 'Problems found, serious cases and crops that need a visit.'],
  'Cooperative Manager': ['Your cooperative', 'Your own farm first, and the tools to manage your members.'],
};

export function RoleSummary({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { data } = useRoleSummary();
  if (!data) return null;
  const [title, sub] = TITLES[data.role] || TITLES.Farmer;
  const o = data.operations;
  const h = data.crop_health;
  const manager = data.role === 'Farm Manager' || data.role === 'Cooperative Manager';
  const B = (s: string) => <AppText weight="700" style={{ fontSize: 13 }}>{s}</AppText>;
  const go = (route: string) => () => navigation.navigate(route);

  return (
    <View style={{ gap: 12, marginBottom: 16 }} accessibilityLabel={t(title)}>
      <View>
        <AppText weight="700" style={{ fontSize: 18 }}>{t(title)}</AppText>
        <AppText style={{ fontSize: 13, color: colors.textLight }}>{t(sub)}</AppText>
      </View>
      {data.organization ? (
        <ChartCard title="Your cooperative" icon="people-group">
          <AppText style={{ fontSize: 13, marginBottom: 10 }}>
            {data.organization.has_workspace
              ? t('Open your organization to manage farmers, invitations and your team.')
              : t('Cooperatives manage their farmers from an organization account: invite farmers, follow their crops and see the whole picture. Register one with a separate organization account.')}
          </AppText>
          {!data.organization.has_workspace ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Register it on the web app with a separate organization account.')}</AppText> : null}
        </ChartCard>
      ) : null}
      {h ? (
        <>
          <Card icon="bug" title="Problems found in the last 30 days" count={h.problems_count} empty="No pest or disease reported." onOpen={go('scouting')}
            rows={h.problems_found.map((r: any) => ({ left: <><AppText weight="700" style={{ fontSize: 13 }}>{`${t(r.kind)}${r.crop ? ` · ${r.crop}` : ''}`}</AppText><AppText style={{ fontSize: 12, color: colors.textLight }}>{r.note}</AppText></>, right: formatDate(r.date) }))} />
          <Card icon="triangle-exclamation" title="Serious cases" count={h.serious_count} empty="No serious case." onOpen={go('crop-protection')}
            rows={h.serious_issues.map((r: any) => ({ left: B(`${r.name} · ${t(r.severity)}`), right: formatDate(r.date) }))} />
          <Card icon="magnifying-glass" title="Crops not scouted for 14 days" count={h.needs_visit_count} empty="Every growing crop was scouted recently." onOpen={go('scouting')}
            rows={h.needs_visit.map((r: any) => ({ left: B(r.crop), right: t(r.status) }))} />
          <ChartCard title="Photo diagnoses" icon="wand-magic-sparkles" right={<Button title="Open" size="sm" kind="secondary" onPress={go('assistant')} />}>
            <AppText style={{ fontSize: 13 }}>{`${h.diagnoses_30d} ${t('in the last 30 days')} · ${h.healthy_visits} ${t('healthy scouting visits')}`}</AppText>
          </ChartCard>
        </>
      ) : null}
      {o ? (
        <>
          <Card icon="hourglass-end" title="Harvests past their date" count={o.overdue_count} empty="No harvest is late." onOpen={go('crop-cycles')}
            rows={o.overdue_harvests.map((r: any) => ({ left: B(r.crop), right: formatDate(r.due) }))} />
          <Card icon="wheat-awn" title="Harvest in the next 14 days" count={o.harvest_soon_count} empty="No harvest due soon." onOpen={go('crop-cycles')}
            rows={o.harvest_soon.map((r: any) => ({ left: B(r.crop), right: formatDate(r.due) }))} />
          <Card icon="boxes-stacked" title="Stock running low" count={o.low_stock_count} empty="Stock levels are fine." onOpen={go('inventory')}
            rows={o.low_stock.map((r: any) => ({ left: B(r.name), right: `${r.quantity} / ${r.minimum} ${r.unit || ''}` }))} />
          {manager ? (
            <>
              <Card icon="wrench" title="Machines due for service" count={o.maintenance_due_count} empty="No service is due." onOpen={go('maintenance')}
                rows={o.maintenance_due.map((r: any) => ({ left: B(r.name), right: `${r.overdue ? `${t('Late')} · ` : ''}${formatDate(r.due)}` }))} />
              <ChartCard title="Work and spending" icon="receipt" right={<Button title="Open" size="sm" kind="secondary" onPress={go('expenses')} />}>
                <AppText style={{ fontSize: 13 }}>{`${formatNumber(o.spending.this_month)} ${t('spent this month')} · ${formatNumber(o.spending.last_month)} ${t('last month')}`}</AppText>
                <AppText style={{ fontSize: 13, marginTop: 4 }}>{`${o.work_this_week.activities} ${t('field activities in the last 7 days')}`}</AppText>
              </ChartCard>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
