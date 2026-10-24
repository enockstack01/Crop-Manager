import React from 'react';
import { RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAdminOverview, RECORD_LABELS } from '../../lib/adminApi';
import { displayName, formatDate, formatDateTime, formatNumber, formatTotals } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Badge, ChartCard, EmptyState, Grid, Loading, PageHeader, Screen, StatTile } from '../../components/ui';
import { Button } from '../../components/Button';
import { ListRow, StatusPill, useAccountActions } from './bits';
import { t } from '../../i18n';

/** web Admin Overview: platform-wide numbers, account requests waiting for approval, records by module, recent sign-ups. */
export function AdminOverviewScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { data, isLoading, isError, refetch, isFetching } = useAdminOverview();
  const { start, dialog } = useAccountActions();

  if (isLoading) return <Loading label="Loading admin overview..." />;
  if (isError || !data) return <EmptyState icon="triangle-exclamation" title="Could not load overview" actionLabel="Try again" onAction={refetch} />;

  const { users, records, finance, recent_users: recent = [], pending_requests: requests = [] } = data;
  const totalRecords = Object.values(records as Record<string, number>).reduce((s, n) => s + n, 0);
  const open = (userId: string) => nav.navigate('admin-users', { screen: 'admin-user', params: { userId } });

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Admin Overview" subtitle="Platform-wide activity across all users." />

      <Grid columns={2} gap={12}>
        <StatTile label="Total Users" value={users.total} color="#2E7D32" />
        <StatTile label="Pending Requests" value={users.pending || 0} color={users.pending ? '#F9A825' : '#2E7D32'} />
        <StatTile label="Active Users" value={users.active} color="#1B5E20" />
        <StatTile label="Administrators" value={users.admins} color="#5B6B5D" />
        <StatTile label="On Hold" value={users.on_hold || 0} color={users.on_hold ? '#F9A825' : '#2E7D32'} />
        <StatTile label="Deactivated" value={users.deactivated || 0} color={users.deactivated ? '#C62828' : '#2E7D32'} />
        <StatTile label="Total Records" value={formatNumber(totalRecords)} color="#1B5E20" />
        <StatTile label="Sales Value (all users)" value={formatTotals(finance.sales_by_currency) || '—'} color="#2E7D32" />
        <StatTile label="Expenses (all users)" value={formatTotals(finance.expenses_by_currency) || '—'} color="#C62828" />
      </Grid>

      <View style={{ gap: 20, marginTop: 20 }}>
        <ChartCard title={t('Account requests')} icon="user-clock" bodyStyle={{ padding: 0 }}>
          {requests.length === 0 ? (
            <AppText style={{ fontSize: 13, color: colors.textLight, textAlign: 'center', padding: 24 }}>{t('No requests waiting for approval')}</AppText>
          ) : (
            requests.map((u: any, i: number) => (
              <View key={u.id} style={{ borderBottomWidth: i === requests.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                <ListRow
                  title={`${displayName(u)} · ${u.email || u.user_id}`}
                  lines={[`${u.access_request?.account_type || ''} · ${u.access_request?.organization || ''}, ${u.access_request?.country || ''}`, `${t('Sent')} ${formatDateTime(u.access_request?.submitted_at)}`]}
                  onPress={() => open(u.user_id)}
                  last
                />
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Button title="Approve" icon="circle-check" size="sm" onPress={() => start(u, 'approve')} />
                  <Button title="Hold" icon="circle-pause" size="sm" kind="secondary" onPress={() => start(u, 'hold')} />
                  <Button title="Reject" icon="circle-xmark" size="sm" kind="danger" onPress={() => start(u, 'reject')} />
                </View>
              </View>
            ))
          )}
        </ChartCard>

        <ChartCard title={t('Records by module')} icon="layer-group">
          {Object.entries(records as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <AppText style={{ fontSize: 13, color: colors.textLight }}>{t(RECORD_LABELS[k] || k)}</AppText>
              <AppText weight="700" style={{ fontSize: 13 }}>{formatNumber(n)}</AppText>
            </View>
          ))}
        </ChartCard>

        <ChartCard title={t('Recent sign-ups')} icon="user-clock" bodyStyle={{ padding: 0 }}>
          {recent.length === 0 ? (
            <AppText style={{ fontSize: 13, color: colors.textLight, textAlign: 'center', padding: 24 }}>{t('No users yet')}</AppText>
          ) : (
            recent.map((u: any, i: number) => (
              <ListRow
                key={u.id}
                title={displayName(u)}
                lines={[`${u.email || '—'} · ${u.role || ''}`, formatDate(u.created_at)]}
                right={u.is_admin ? <Badge label="Admin" tone="primary" /> : u.account_status !== 'active' ? <StatusPill status={u.account_status} /> : undefined}
                onPress={() => open(u.user_id)}
                last={i === recent.length - 1}
              />
            ))
          )}
        </ChartCard>
      </View>
      {dialog}
    </Screen>
  );
}
