import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Badge, ChartCard, EmptyState, Grid, Loading, StatTile } from '../components/ui';
import { Button } from '../components/Button';
import { SelectField, TextField } from '../components/fields';
import { useToast } from '../components/Toast';
import { formatCurrency, formatDate, formatNumber } from '../lib/format';
import { VERDICTS, useGhAlerts, useGhMutations, useGhOverview, useGhRevenueHistory } from '../lib/greenhouse';
import { t } from '../i18n';

/*
 * The first page of each role, the alerts, and the harvest value over the weeks (the same as on the website).
 *   ManagerDashboard    the farm manager: totals, the last weeks, each greenhouse, diseased plants, alerts, who is recording
 *   CollectorDashboard  the data collector: what is left to record, what they did, which counts to redo. No totals, alerts or disease details.
 *   AlertsTab           plants whose numbers do not add up, with a way to explain each one
 *   HistoryCard         the expected value and the loss to disease, week by week
 */
function WeekBars({ labels, values, color, format }: { labels: string[]; values: number[]; color: string; format: (n: number) => string }) {
  const { colors } = useTheme();
  const top = Math.max(1, ...values);
  return (
    <View style={{ gap: 6 }}>
      {values.map((v, i) => (
        <View key={`${labels[i]}${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppText style={{ width: 52, fontSize: 11, color: colors.textLight }}>{labels[i]}</AppText>
          <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.border }}>
            <View style={{ height: 12, borderRadius: 6, width: `${Math.max(v > 0 ? 3 : 0, (v / top) * 100)}%`, backgroundColor: color }} />
          </View>
          <AppText weight="600" style={{ width: 62, fontSize: 11, textAlign: 'right' }}>{format(v)}</AppText>
        </View>
      ))}
    </View>
  );
}
const short = (iso: string) => formatDate(iso).replace(/,? \d{4}$/, '');

/* ------------------------------------------------------- value over time */
export function HistoryCard({ greenhouse = '', risk = 20 }: { greenhouse?: string; risk?: number }) {
  const { colors } = useTheme();
  const { data } = useGhRevenueHistory({ greenhouse, risk, weeks: 12 });
  if (!data) return <ChartCard title="Over the weeks" icon="chart-line"><Loading /></ChartCard>;
  const w: any[] = data.weeks;
  const cur = w.map((x) => x.money[0]?.currency).find(Boolean);
  const priced = w.some((x) => x.money[0]?.net > 0);
  const last = w[w.length - 1];
  const prev = [...w].reverse().find((x, i) => i > 0 && x.fruit > 0);
  const trend = last && prev ? Math.round((last.loss_share_pct - prev.loss_share_pct) * 10) / 10 : null;
  const labels = w.map((x) => short(x.week));
  return (
    <ChartCard title="Over the weeks" icon="chart-line">
      {trend !== null ? (
        <AppText style={{ fontSize: 13, lineHeight: 19, marginBottom: 10, color: trend > 0.5 ? colors.red : colors.textLight }}>
          {trend > 0.5 ? t('Disease loss is growing: {{n}} points higher than in the earlier week shown.', { n: trend }) : trend < -0.5 ? t('Disease loss is falling: {{n}} points lower than in the earlier week shown.', { n: Math.abs(trend) }) : t('Disease loss is steady.')}
        </AppText>
      ) : null}
      <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, marginBottom: 6 }}>{priced ? `${t('Expected value')} (${cur})` : t('Fruit counted')}</AppText>
      <WeekBars labels={labels} values={w.map((x) => (priced ? x.money[0]?.net ?? 0 : x.fruit))} color={colors.primary} format={(n) => formatNumber(Math.round(n))} />
      <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, marginTop: 14, marginBottom: 6 }}>{t('Lost to disease')} (%)</AppText>
      <WeekBars labels={labels} values={w.map((x) => x.loss_share_pct)} color={colors.red} format={(n) => `${n}%`} />
      <AppText style={{ fontSize: 12, lineHeight: 17, color: colors.textLight, marginTop: 10 }}>{t(data.note)}</AppText>
    </ChartCard>
  );
}

/* ----------------------------------------------------- farm manager page */
export function ManagerDashboard({ go }: { go: (id: string) => void }) {
  const { colors } = useTheme();
  const { data: o, isLoading, isError, refetch } = useGhOverview();
  if (isLoading) return <Loading />;
  if (isError || !o || !o.headline) return <EmptyState icon="triangle-exclamation" title="Could not load the overview" actionLabel="Retry" onAction={() => refetch()} />;
  if (!o.houses.length) return <EmptyState icon="warehouse" title="No greenhouse yet" description="The overview appears once a greenhouse is set up and plants are counted." />;
  const H = o.headline;
  const money = H.money[0];
  const priced = H.money.some((m: any) => m.gross > 0);
  const labels = o.trend.map((x: any) => short(x.week));
  return (
    <View style={{ gap: 14 }}>
      {o.alerts.summary.open_high > 0 ? (
        <View style={{ padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.red, backgroundColor: colors.card, gap: 8 }}>
          <AppText weight="700" style={{ fontSize: 14, color: colors.red }}>{t('{{n}} plants need a look', { n: o.alerts.summary.open_high })}</AppText>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('Their counts do not add up: fruit are missing or were not written down.')}</AppText>
          <View style={{ alignSelf: 'flex-start' }}><Button title="See the alerts" size="sm" kind="secondary" onPress={() => go('alerts')} /></View>
        </View>
      ) : null}
      <Grid columns={2} gap={10}>
        <StatTile label="Fruit counted" value={formatNumber(H.fruit)} sub={`${H.counted_plants} ${t('of')} ${H.active_plants} ${t('plants')}`} />
        <StatTile label="Healthy fruit" value={formatNumber(H.healthy_fruit)} sub={`${t('of')} ${formatNumber(H.fruit)}`} />
        <StatTile label="Lost to disease" value={`${H.loss_share_pct}%`} sub={`${H.sick_plants} ${t('diseased plants')}`} />
        {priced && money ? <StatTile label="Expected value" value={formatCurrency(money.net, money.currency)} sub={`${t('whole greenhouse')} ${formatCurrency(money.whole_net, money.currency)}`} /> : <StatTile label="Whole greenhouse" value={formatNumber(H.whole_fruit_net)} sub={t('fruit expected')} />}
        <StatTile label="Open alerts" value={formatNumber(o.alerts.summary.open)} sub={`${o.alerts.summary.open_high} ${t('high')}`} color={o.alerts.summary.open_high ? colors.red : undefined} />
      </Grid>

      <ChartCard title="The last eight weeks" icon="chart-line">
        <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, marginBottom: 6 }}>{priced && money ? `${t('Expected value')} (${money.currency})` : t('Fruit counted')}</AppText>
        <WeekBars labels={labels} values={o.trend.map((x: any) => (priced ? x.net ?? 0 : x.fruit))} color={colors.primary} format={(n) => formatNumber(Math.round(n))} />
        <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, marginTop: 14, marginBottom: 6 }}>{t('Lost to disease')} (%)</AppText>
        <WeekBars labels={labels} values={o.trend.map((x: any) => x.loss_share_pct)} color={colors.red} format={(n) => `${n}%`} />
        <View style={{ alignSelf: 'flex-start', marginTop: 12 }}><Button title="Harvest value" size="sm" kind="secondary" onPress={() => go('harvest')} /></View>
      </ChartCard>

      <ChartCard title="Each greenhouse" icon="warehouse">
        <View style={{ gap: 10 }}>
          {o.houses.map((h: any) => (
            <View key={h.id} style={{ gap: 3 }}>
              <AppText weight="700" style={{ fontSize: 14 }}>{h.name}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{h.counted_plants} / {h.active_positions} {t('plants counted')} · {h.stale_plants + h.uncounted_plants} {t('not counted in 7 days')}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{h.sick_plants} {t('diseased plants')} · {formatNumber(h.fruit)} {t('fruit')} · {h.loss_share_pct}% {t('lost to disease')}</AppText>
            </View>
          ))}
        </View>
      </ChartCard>

      <ChartCard title="Diseased plants" icon="virus">
        {o.diseased.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('No diseased plants in the latest counts.')}</AppText> : (
          <View style={{ gap: 8 }}>
            {o.diseased.map((p: any) => (
              <View key={`${p.greenhouse}${p.row_id}${p.plant_label}`}>
                <AppText weight="700" style={{ fontSize: 14 }}>{p.row_id} {p.plant_label} · {p.crop}</AppText>
                <AppText style={{ fontSize: 12, color: colors.textLight }}>{p.disease || t('Possible disease')} · {p.sick_fruit}/{p.fruit} {t('sick fruit')}</AppText>
              </View>
            ))}
          </View>
        )}
        <View style={{ alignSelf: 'flex-start', marginTop: 10 }}><Button title="Disease report" size="sm" kind="secondary" onPress={() => go('disease')} /></View>
      </ChartCard>

      <ChartCard title="Who is recording" icon="user-group">
        {o.activity.people.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Nothing was recorded in the last 7 days.')}</AppText> : (
          <View style={{ gap: 6 }}>
            {o.activity.people.map((p: any) => <AppText key={p.name} style={{ fontSize: 13 }}><AppText weight="700">{p.name}</AppText> · {p.counts} {t('counts')} · {formatNumber(p.fruit)} {t('fruit')} {t('in 7 days')}</AppText>)}
          </View>
        )}
      </ChartCard>

      {o.alerts.top.length > 0 ? (
        <ChartCard title="Needs a look" icon="triangle-exclamation">
          <View style={{ gap: 8 }}>
            {o.alerts.top.map((a: any) => (
              <View key={`${a.kind}${a.count_id}`}>
                <AppText weight="700" style={{ fontSize: 14 }}>{a.greenhouse} {a.row_id} {a.plant_label}</AppText>
                <AppText style={{ fontSize: 12, lineHeight: 17, color: colors.textLight }}>{a.message}</AppText>
              </View>
            ))}
          </View>
          <View style={{ alignSelf: 'flex-start', marginTop: 10 }}><Button title="All alerts" size="sm" kind="secondary" onPress={() => go('alerts')} /></View>
        </ChartCard>
      ) : null}
      {o.notes.map((n: string) => <AppText key={n} style={{ fontSize: 12, lineHeight: 17, color: colors.textLight }}>{n}</AppText>)}
    </View>
  );
}

/* -------------------------------------------------- data collector's page */
export function CollectorDashboard({ go }: { go: (id: string) => void }) {
  const { colors } = useTheme();
  const { data: o, isLoading, isError, refetch } = useGhOverview();
  if (isLoading) return <Loading />;
  if (isError || !o || o.role !== 'collector') return <EmptyState icon="triangle-exclamation" title="Could not load your day" actionLabel="Retry" onAction={() => refetch()} />;
  const left = o.todo.reduce((s: number, h: any) => s + h.remaining, 0);
  const tone = (s: string) => (VERDICTS as any)[s] || (VERDICTS as any).not_checked;
  return (
    <View style={{ gap: 14 }}>
      <Grid columns={2} gap={10}>
        <StatTile label="Recorded today" value={formatNumber(o.today.counts)} sub={`${formatNumber(o.today.fruit)} ${t('fruit')}`} />
        <StatTile label="Recorded this week" value={formatNumber(o.week.counts)} sub={`${formatNumber(o.week.fruit)} ${t('fruit')}`} />
        <StatTile label="Plants left this week" value={formatNumber(left)} sub={left === 0 ? t('All done') : t('not counted in 7 days')} />
      </Grid>
      <Button title="Open the plan and record" icon="table-cells" onPress={() => go('layout')} />

      {o.recount.length > 0 ? (
        <View style={{ padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.orange, backgroundColor: colors.card, gap: 6 }}>
          <AppText weight="700" style={{ fontSize: 14 }}>{t('Count again')}</AppText>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('The photo did not match these. Count the fruit again and take a clear photo of each part of the plant.')}</AppText>
          {o.recount.map((r: any) => <AppText key={r.id} style={{ fontSize: 13 }}><AppText weight="700">{r.greenhouse} {r.row_id} {r.plant_label}</AppText> · {t('you recorded')} {r.recorded_count}</AppText>)}
        </View>
      ) : null}

      {o.todo.map((h: any) => {
        const pct = h.active_positions ? Math.round((h.counted_this_week / h.active_positions) * 100) : 0;
        return (
          <ChartCard key={h.id} title={h.name} icon="warehouse">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <AppText style={{ fontSize: 13 }}>{h.counted_this_week} / {h.active_positions} {t('plants counted this week')}</AppText>
              <AppText style={{ fontSize: 13 }}>{h.remaining} {t('left')}</AppText>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border }}><View style={{ height: 10, borderRadius: 5, width: `${pct}%`, backgroundColor: colors.primary }} /></View>
            {h.next.length > 0 ? (
              <>
                <AppText style={{ fontSize: 12, color: colors.textLight, marginTop: 12, marginBottom: 6 }}>{t('Next to record')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {h.next.map((p: any) => (
                    <View key={`${p.row_id}${p.plant_label}`} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                      <AppText weight="600" style={{ fontSize: 12 }}>{p.row_id} {p.plant_label}{p.last ? '' : ' •'}</AppText>
                    </View>
                  ))}
                  {h.remaining > h.next.length ? <AppText style={{ fontSize: 12, color: colors.textLight, alignSelf: 'center' }}>+{h.remaining - h.next.length}</AppText> : null}
                </View>
              </>
            ) : null}
          </ChartCard>
        );
      })}

      <ChartCard title="Your latest counts" icon="clock-rotate-left">
        {o.recent.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('You have not recorded anything yet.')}</AppText> : (
          <View style={{ gap: 10 }}>
            {o.recent.map((r: any) => (
              <View key={r.id} style={{ gap: 3 }}>
                <AppText weight="700" style={{ fontSize: 14 }}>{r.greenhouse} {r.row_id} {r.plant_label}</AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{r.recorded_count} {t('fruit')} · {formatDate(r.count_date)}</AppText>
                  <Badge label={t(tone(r.status).label)} tone={tone(r.status).tone} />
                </View>
              </View>
            ))}
          </View>
        )}
      </ChartCard>
      {o.frozen.length > 0 ? (
        <ChartCard title="Plants to leave alone" icon="snowflake">
          <View style={{ gap: 6 }}>{o.frozen.map((f: any) => <AppText key={`${f.greenhouse}${f.row_id}${f.plant_label}`} style={{ fontSize: 13 }}><AppText weight="700">{f.row_id} {f.plant_label}</AppText> · {f.reason || t('Frozen')}</AppText>)}</View>
        </ChartCard>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ alerts */
const KIND: Record<string, string> = { under_recorded: 'Recorded below the photo', fall: 'Count fell' };

function AlertCard({ a }: { a: any }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { ackAlert } = useGhMutations();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const save = async (state?: 'open') => {
    try {
      await ackAlert.mutateAsync({ id: a.count_id, kind: a.kind, ...(state === 'open' ? { state: 'open' } : { reason }) });
      setOpen(false);
      setReason('');
    } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  const edge = a.ack ? colors.primary : a.severity === 'high' ? colors.red : colors.orange;
  return (
    <View style={{ gap: 6, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: edge, backgroundColor: colors.card, opacity: a.ack ? 0.75 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <AppText weight="700" style={{ fontSize: 15 }}>{a.greenhouse} {a.row_id} {a.plant_label}</AppText>
        <Badge label={t(a.severity === 'high' ? 'High' : 'Medium')} tone={a.severity === 'high' ? 'danger' : 'warning'} />
        <Badge label={t(KIND[a.kind])} tone="info" />
      </View>
      <AppText style={{ fontSize: 13, lineHeight: 19 }}>{a.message}</AppText>
      <AppText style={{ fontSize: 12, color: colors.textLight }}>{formatDate(a.date)}{a.to.entered_by_name ? ` · ${t('recorded by')} ${a.to.entered_by_name}` : ''}</AppText>
      {a.ack ? (
        <View style={{ gap: 6 }}>
          <AppText style={{ fontSize: 13 }}>{t('Explained')}: {a.ack.reason}</AppText>
          <View style={{ alignSelf: 'flex-start' }}><Button title="Open again" size="sm" kind="secondary" loading={ackAlert.isPending} onPress={() => save('open')} /></View>
        </View>
      ) : open ? (
        <View style={{ gap: 6 }}>
          <TextField label="What explains it?" value={reason} onChangeValue={setReason} placeholder={t('For example harvested on Tuesday, pruned, wind damage')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Save" size="sm" disabled={reason.trim().length < 3} loading={ackAlert.isPending} onPress={() => save()} />
            <Button title="Cancel" size="sm" kind="secondary" onPress={() => setOpen(false)} />
          </View>
        </View>
      ) : (
        <View style={{ alignSelf: 'flex-start' }}><Button title="Explain this" icon="comment" size="sm" kind="secondary" onPress={() => setOpen(true)} /></View>
      )}
    </View>
  );
}

export function AlertsTab() {
  const { colors } = useTheme();
  const [days, setDays] = useState('30');
  const [show, setShow] = useState('open');
  const { data, isLoading, isError, refetch } = useGhAlerts({ days: Number(days) });
  if (isLoading) return <Loading />;
  if (isError || !data) return <EmptyState icon="triangle-exclamation" title="Could not load the alerts" actionLabel="Retry" onAction={() => refetch()} />;
  const S = data.summary;
  const list = data.alerts.filter((a: any) => (show === 'open' ? !a.ack : show === 'explained' ? !!a.ack : true));
  const flagged = data.people.filter((p: any) => p.flagged);
  return (
    <View style={{ gap: 12 }}>
      <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('These are signs to look into, not proof of theft: fruit also drops after a harvest, pruning, wind, pests and disease. Explain each one so only the unexplained stay open.')}</AppText>
      <SelectField label="Period" value={days} onChangeValue={setDays} placeholder="" options={[14, 30, 60, 90].map((d) => ({ value: String(d), label: t('Last {{n}} days', { n: d }) }))} />
      <SelectField label="Show" value={show} onChangeValue={setShow} placeholder="" options={[{ value: 'open', label: t('Open') }, { value: 'explained', label: t('Explained') }, { value: 'all', label: t('All') }]} />
      <Grid columns={2} gap={10}>
        <StatTile label="Open alerts" value={formatNumber(S.open)} sub={`${S.open_high} ${t('high')}`} color={S.open_high ? colors.red : undefined} />
        <StatTile label="Explained" value={formatNumber(S.explained)} />
        <StatTile label="People to talk to" value={formatNumber(S.people_flagged)} sub={t('often record below the photo')} />
      </Grid>
      {flagged.length > 0 ? (
        <View style={{ padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.orange, backgroundColor: colors.card, gap: 4 }}>
          {flagged.map((p: any) => <AppText key={p.entered_by} style={{ fontSize: 13 }}><AppText weight="700">{p.name || t('Someone')}</AppText>: {p.under} {t('of')} {p.decided} {t('checked counts were below the photo')} ({p.under_share}%).</AppText>)}
        </View>
      ) : null}
      {list.length === 0 ? <EmptyState icon="shield-halved" title={show === 'open' ? 'No open alerts' : 'Nothing here'} description="Every count agrees with its photo and no plant lost fruit without an explanation." /> : list.map((a: any) => <AlertCard key={`${a.kind}${a.count_id}`} a={a} />)}
    </View>
  );
}
