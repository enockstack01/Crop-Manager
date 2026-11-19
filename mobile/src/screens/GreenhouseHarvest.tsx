import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, ChartCard, EmptyState, Grid, Loading, StatTile } from '../components/ui';
import { Button } from '../components/Button';
import { NumberField, SelectField, TextField } from '../components/fields';
import { useToast } from '../components/Toast';
import { formatCurrency, formatNumber, getCurrency } from '../lib/format';
import { useGhCrops, useGhHouses, useGhMutations, useGhRevenue } from '../lib/greenhouse';
import { t } from '../i18n';

/** What the harvest could be worth: fruit counted, the healthy share, the loss to disease and the money, with the rest of the house projected. */
export function HarvestTab({ role = 'owner' }: { role?: string }) {
  const { colors } = useTheme();
  const { data: houses = [] } = useGhHouses();
  const [house, setHouse] = useState('');
  const [risk, setRisk] = useState('20');
  const pct = Math.min(100, Math.max(0, Number(risk) || 0));
  const { data: v, isLoading, isError, refetch } = useGhRevenue({ greenhouse: house, risk: pct });
  if (isLoading) return <Loading />;
  if (isError || !v) return <EmptyState icon="triangle-exclamation" title="Could not load the harvest value" actionLabel="Retry" onAction={() => refetch()} />;
  const T = v.totals;
  const cur = v.money[0];
  const priced = v.money.some((m: any) => m.gross > 0);
  const scenarios = cur && priced ? [
    { label: 'Sold as it is', value: cur.gross, color: '#B0BEC5' }, { label: 'Best case', value: cur.net_best, color: '#7CB342' },
    { label: 'Expected', value: cur.net, color: colors.primary }, { label: 'Worst case', value: cur.net_worst, color: '#C62828' },
  ] : [];
  const top = Math.max(1, ...scenarios.map((s) => s.value));
  return (
    <View style={{ gap: 14 }}>
      <SelectField label="Greenhouse" value={house} onChangeValue={setHouse} placeholder="" options={[{ value: '', label: t('All greenhouses') }, ...houses.map((h: any) => ({ value: h.name, label: h.name }))]} />
      <NumberField label="Fruit at risk on a diseased plant (%)" value={risk} onChangeValue={setRisk} hint={t('The share of the other fruit on a diseased plant that may be lost too.')} />
      {T.counted_plants === 0 ? (
        <EmptyState icon="coins" title="Nothing to value yet" description="Count the fruit on some plants first. The value follows from the counts, the health checks and the price of each crop." />
      ) : (
        <>
          {!priced ? (
            <View style={{ padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.orange, backgroundColor: colors.card }}>
              <AppText style={{ fontSize: 13, lineHeight: 19 }}>{role === 'owner' ? t('Set the price per kilogram of each crop under My crops to see the money.') : t('The farm owner has not set the price of the crops yet, so only fruit and weight are shown.')}</AppText>
            </View>
          ) : null}
          <Grid columns={2} gap={10}>
            <StatTile label="Fruit counted" value={formatNumber(T.fruit)} sub={`${formatNumber(T.counted_plants)} ${t('plants')} · ${T.kg} kg`} />
            <StatTile label="Healthy fruit" value={formatNumber(T.healthy_fruit)} sub={`${T.kg_net} kg`} />
            <StatTile label="Lost to disease" value={`${T.loss_share_pct}%`} sub={`${formatNumber(T.sick_fruit)} ${t('sick')} + ${formatNumber(T.at_risk_fruit)} ${t('at risk')}`} />
            {priced ? v.money.map((m: any) => <StatTile key={m.currency} label="Expected value" value={formatCurrency(m.net, m.currency)} sub={`${t('instead of')} ${formatCurrency(m.gross, m.currency)}`} />) : null}
          </Grid>
          {T.projected_fruit > 0 ? (
            <ChartCard title="The whole greenhouse" icon="seedling">
              <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight, marginBottom: 10 }}>{t('{{n}} active plants are not counted yet. Giving each the average of the counted plants, with the same disease loss, the whole greenhouse could give about {{f}} fruit ({{k}} kg).', { n: formatNumber(T.active_plants - T.counted_plants), f: formatNumber(T.whole_fruit_net), k: T.whole_kg_net })}</AppText>
              <Grid columns={2} gap={10}>
                <StatTile label="Fruit expected" value={formatNumber(T.whole_fruit_net)} sub={`${t('of')} ${formatNumber(T.whole_fruit)} ${t('before disease')}`} />
                {priced ? v.money.map((m: any) => <StatTile key={m.currency} label="Whole greenhouse value" value={formatCurrency(m.whole_net, m.currency)} sub={`${t('before disease')} ${formatCurrency(m.whole_gross, m.currency)}`} />) : null}
              </Grid>
            </ChartCard>
          ) : null}
          {scenarios.length ? (
            <ChartCard title="Best, expected and worst case" icon="scale-balanced">
              <View style={{ gap: 10 }}>
                {scenarios.map((s) => (
                  <View key={s.label} style={{ gap: 3 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <AppText style={{ fontSize: 13 }}>{t(s.label)}</AppText>
                      <AppText weight="700" style={{ fontSize: 13 }}>{formatCurrency(s.value, cur.currency)}</AppText>
                    </View>
                    <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.border }}>
                      <View style={{ height: 12, borderRadius: 6, width: `${Math.max(2, (s.value / top) * 100)}%`, backgroundColor: s.color }} />
                    </View>
                  </View>
                ))}
              </View>
              <AppText style={{ fontSize: 12, lineHeight: 17, color: colors.textLight, marginTop: 10 }}>{t('Worst case: every fruit of every diseased plant is lost. Best case: only the fruit found sick. Expected: the sick fruit and the share at risk.')}</AppText>
            </ChartCard>
          ) : null}
          <ChartCard title="By crop" icon="seedling">
            <View style={{ gap: 10 }}>
              {v.by_crop.map((r: any) => (
                <View key={r.crop_id} style={{ gap: 2 }}>
                  <AppText weight="700" style={{ fontSize: 14 }}>{r.name}</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{formatNumber(r.fruit)} {t('fruit')} · {formatNumber(r.fruit - r.sick_fruit - r.at_risk_fruit)} {t('healthy')} · {r.loss_share_pct}% {t('lost to disease')} · {r.kg_net} kg</AppText>
                  <AppText style={{ fontSize: 13 }}>{r.price_per_kg != null ? `${formatCurrency(r.net, r.currency)} (${formatCurrency(r.price_per_kg, r.currency)}/kg)` : t('No price set')}</AppText>
                </View>
              ))}
            </View>
          </ChartCard>
          <ChartCard title="By greenhouse" icon="warehouse">
            <View style={{ gap: 10 }}>
              {v.by_house.map((r: any) => (
                <View key={r.id} style={{ gap: 2 }}>
                  <AppText weight="700" style={{ fontSize: 14 }}>{r.name}</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{r.counted_plants} / {r.active_positions} {t('plants counted')} · {r.sick_plants} {t('diseased plants')} · {formatNumber(r.fruit)} {t('fruit')} · {r.loss_share_pct}% {t('lost to disease')}</AppText>
                  {r.projected ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Rest of the house')}: {formatNumber(r.projected.fruit_net)} {t('fruit')} ({r.projected.plants} {t('plants')})</AppText> : null}
                </View>
              ))}
            </View>
          </ChartCard>
          {v.notes.map((n: string) => <AppText key={n} style={{ fontSize: 12, lineHeight: 17, color: colors.textLight }}>{n}</AppText>)}
          <AppText style={{ fontSize: 12, lineHeight: 17, color: colors.textLight }}>{t(v.method)}</AppText>
        </>
      )}
    </View>
  );
}

/** The owner sets the price per kilogram and the weight of one fruit of each crop. */
export function PricesCard() {
  const { colors } = useTheme();
  const toast = useToast();
  const { data: mine = [] } = useGhCrops();
  const { updateCrop } = useGhMutations();
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  if (!mine.length) return null;
  const val = (c: any, k: string, dflt: any) => (edits[c.id]?.[k] !== undefined ? edits[c.id][k] : c[k] ?? dflt);
  const set = (c: any, k: string, v: string) => setEdits((e) => ({ ...e, [c.id]: { ...e[c.id], [k]: v } }));
  const save = async (c: any) => {
    try {
      await updateCrop.mutateAsync({ id: c.id, price_per_kg: val(c, 'price_per_kg', null), fruit_weight_g: val(c, 'fruit_weight_g', 100), currency: c.price_per_kg == null ? val(c, 'currency', getCurrency()) : val(c, 'currency', c.currency) });
      setEdits((x) => { const n = { ...x }; delete n[c.id]; return n; });
      toast(t('Saved'));
    } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  return (
    <ChartCard title="Prices and fruit weight" icon="coins">
      <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight, marginBottom: 10 }}>{t('The harvest value is worked out from the fruit counted, the weight of one fruit and the price per kilogram. The weights start at a typical value: change them to match your own fruit.')}</AppText>
      <View style={{ gap: 16 }}>
        {mine.map((c: any) => (
          <View key={c.id} style={{ gap: 4 }}>
            <AppText weight="700" style={{ fontSize: 15 }}>{c.name}</AppText>
            <NumberField label="Weight of one fruit (g)" value={String(val(c, 'fruit_weight_g', 100))} onChangeValue={(v: string) => set(c, 'fruit_weight_g', v)} />
            <NumberField label="Price per kg" value={String(val(c, 'price_per_kg', '') ?? '')} onChangeValue={(v: string) => set(c, 'price_per_kg', v)} placeholder={t('not set')} />
            <TextField label="Currency" value={edits[c.id]?.currency !== undefined ? edits[c.id].currency : c.price_per_kg == null ? getCurrency() : c.currency} onChangeValue={(v: string) => set(c, 'currency', v)} autoCapitalize="characters" />
            <View style={{ alignSelf: 'flex-start' }}><Button title="Save" size="sm" disabled={!edits[c.id]} loading={updateCrop.isPending} onPress={() => save(c)} /></View>
          </View>
        ))}
      </View>
    </ChartCard>
  );
}
