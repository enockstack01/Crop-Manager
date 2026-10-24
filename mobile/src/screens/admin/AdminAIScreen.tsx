import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAdminMutations, useAiAdmin } from '../../lib/adminApi';
import { formatNumber } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Badge, ChartCard, EmptyState, Grid, Loading, PageHeader, Screen, StatTile } from '../../components/ui';
import { Bars } from '../../components/charts';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { NumberField, SelectField } from '../../components/fields';
import { Chips } from './bits';
import { t } from '../../i18n';

const FEATURES: Record<string, string> = {
  chat: 'Farm chat', diagnose: 'Disease detection', insights: 'Farm insights', advice_inputs: 'Advice: inputs', advice_planting: 'Advice: planting',
  advice_fertiliser: 'Advice: fertiliser', advice_irrigation: 'Advice: irrigation', advice_protection: 'Advice: protection', advice_harvest: 'Advice: harvest',
  summary: 'Season summary', record: 'Quick record', calculator: 'Calculator help', weather: 'Weather advice', admin_test: 'Connection test', translate: 'Translation',
};
const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

/** web AI assistant admin: which models may be used and for what, rate limits, usage and failures. */
export function AdminAIScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, refetch } = useAiAdmin(days);
  const { saveModels, saveLimits, testAi } = useAdminMutations();
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [tasks, setTasks] = useState<Record<string, string> | null>(null);
  const [limits, setLimits] = useState<{ daily: string; hourly: string } | null>(null);
  const [result, setResult] = useState<Record<string, any>>({});

  useEffect(() => {
    if (data && enabled === null) {
      setEnabled(data.tiers.filter((x: any) => x.enabled).map((x: any) => x.id));
      setTasks(Object.fromEntries(data.tasks.map((x: any) => [x.id, x.tier])));
    }
  }, [data, enabled]);

  if (isLoading) return <Loading label="Loading AI settings..." />;
  if (isError || !data) return <EmptyState icon="triangle-exclamation" title="Could not load the AI settings" actionLabel="Try again" onAction={refetch} />;

  const on = enabled || [];
  const toggle = (id: string) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    if (!next.length) { toast(t('Keep at least one model turned on'), 'error'); return; }
    setEnabled(next);
    setTasks((cur) => Object.fromEntries(Object.entries(cur || {}).map(([k, v]) => [k, next.includes(v) ? v : next[0]])));
  };
  const dirty = JSON.stringify(on.slice().sort()) !== JSON.stringify(data.tiers.filter((x: any) => x.enabled).map((x: any) => x.id).sort()) || data.tasks.some((x: any) => tasks && tasks[x.id] !== x.tier);
  const saveM = async () => { try { await saveModels.mutateAsync({ enabled: on, tasks }); toast(t('Models saved')); } catch (e: any) { toast(e?.message, 'error'); } };
  const lim = limits || { daily: String(data.limits.daily), hourly: String(data.limits.hourly) };
  const saveL = async () => { try { await saveLimits.mutateAsync({ daily: Number(lim.daily), hourly: Number(lim.hourly) }); toast(t('AI limits saved')); setLimits(null); } catch (e: any) { toast(e?.message, 'error'); } };
  const runTest = async (task: string) => {
    setResult((r) => ({ ...r, [task]: { busy: true } }));
    try { const out = await testAi.mutateAsync(task); setResult((r) => ({ ...r, [task]: { ok: true, ms: out.ms } })); } catch (e: any) { setResult((r) => ({ ...r, [task]: { ok: false, message: e?.message } })); }
  };

  const u = data.usage;
  const labelOf = Object.fromEntries(data.tiers.map((x: any) => [x.id, x.label]));

  return (
    <Screen>
      <PageHeader title="AI assistant" subtitle="Choose the models the platform may use, set the limits per user and watch the usage." />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 16 }}>
        <Icon name={data.configured ? 'circle-check' : 'plug-circle-xmark'} size={13} color={data.configured ? colors.primary : colors.red} />
        <AppText style={{ fontSize: 12, flexShrink: 1 }}>{data.configured ? t('The AI assistant is switched on.') : t('The AI assistant is not set up yet. Add the service key on the server to switch it on.')}{data.mock ? ` · ${t('Sample answers (testing mode)')}` : ''}</AppText>
      </View>

      <View style={{ gap: 20 }}>
        <ChartCard title={t('Models')} icon="microchip">
          <AppText style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>{t('Turn models on or off, then choose which one handles each kind of work. Faster models cost less; advanced models reason better but are slower.')}</AppText>
          <View style={{ gap: 8, marginBottom: 16 }}>
            {data.tiers.map((x: any) => (
              <Pressable key={x.id} onPress={() => toggle(x.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on.includes(x.id) }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: on.includes(x.id) ? colors.primary : colors.border, borderRadius: 10, padding: 12 }}>
                <Icon name={on.includes(x.id) ? 'square-check' : 'square'} size={18} color={on.includes(x.id) ? colors.primary : colors.textLight} />
                <View style={{ flex: 1 }}>
                  <AppText weight="700" style={{ fontSize: 13 }}>{t(x.label)}</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{t(x.description)}</AppText>
                </View>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: 14 }}>
            {data.tasks.map((x: any) => {
              const r = result[x.id];
              return (
                <View key={x.id} style={{ gap: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <SelectField label={x.label} value={tasks?.[x.id] || x.tier} onChangeValue={(v) => setTasks({ ...(tasks || {}), [x.id]: v })} options={data.tiers.filter((m: any) => on.includes(m.id)).map((m: any) => ({ value: m.id, label: t(m.label) }))} placeholder="" />
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button title={r?.busy ? 'Testing…' : 'Test'} kind="secondary" size="sm" disabled={r?.busy || dirty} onPress={() => runTest(x.id)} />
                    {r?.ok === true ? <Badge label={`${t('Working')} · ${r.ms} ms`} tone="success" /> : null}
                    {r?.ok === false ? <Badge label="Failed" tone="danger" /> : null}
                  </View>
                </View>
              );
            })}
          </View>
          {dirty ? <AppText style={{ fontSize: 12, color: colors.textLight, marginBottom: 8 }}>{t('Save the models before testing them.')}</AppText> : null}
          <View style={{ alignSelf: 'flex-start' }}><Button title="Save models" loading={saveModels.isPending} disabled={!dirty} onPress={saveM} /></View>
        </ChartCard>

        <ChartCard title={t('Rate limits')} icon="gauge">
          <AppText style={{ fontSize: 12, color: colors.textLight, marginBottom: 12 }}>{t("Each user can make this many AI requests. Administrators are not limited. A different daily limit can be set on a user's page.")}</AppText>
          <View style={{ gap: 12 }}>
            <NumberField label="Requests per day" value={lim.daily} onChangeValue={(v) => setLimits({ ...lim, daily: v })} />
            <NumberField label="Requests per hour" value={lim.hourly} onChangeValue={(v) => setLimits({ ...lim, hourly: v })} />
            <View style={{ alignSelf: 'flex-start' }}><Button title="Save" loading={saveLimits.isPending} onPress={saveL} /></View>
          </View>
        </ChartCard>

        <ChartCard title={t('Usage')} icon="chart-column">
          <Chips value={String(days)} onChange={(v) => setDays(Number(v))} options={[7, 30, 90].map((d) => ({ id: String(d), label: t('Last {{days}} days', { days: d }) }))} />
          <Grid columns={2} gap={10}>
            <StatTile label="Requests" value={formatNumber(u.totals.requests)} sub={`${u.totals.errors} ${t('errors')}`} />
            <StatTile label="Users" value={formatNumber(u.totals.users)} sub={`${u.totals.users_today} ${t('today')}`} />
            <StatTile label="Words read" value={compact(u.totals.input_tokens)} sub={`${compact(u.totals.cached_tokens)} ${t('reused')}`} />
            <StatTile label="Words written" value={compact(u.totals.output_tokens)} />
          </Grid>
          <View style={{ marginTop: 16 }}>
            {u.by_day.length ? <Bars labels={u.by_day.map((d: any) => d.day.slice(5))} datasets={[{ label: 'Requests', data: u.by_day.map((d: any) => d.requests), color: '#2E7D32' }]} /> : <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('No AI requests in this period yet.')}</AppText>}
          </View>
          <AppText weight="700" style={{ fontSize: 12, marginTop: 16, marginBottom: 4, color: colors.primaryDark }}>{t('By model')}</AppText>
          {u.by_model.map((m: any) => <AppText key={m.model} style={{ fontSize: 12, paddingVertical: 2 }}><AppText weight="700" style={{ fontSize: 12 }}>{labelOf[m.model] ? t(labelOf[m.model]) : m.model}</AppText> · {m.requests} {t('requests')} · {compact(m.input_tokens + m.output_tokens)} {t('words')}{m.errors ? ` · ${m.errors} ${t('errors')}` : ''}</AppText>)}
          <AppText weight="700" style={{ fontSize: 12, marginTop: 12, marginBottom: 4, color: colors.primaryDark }}>{t('By feature')}</AppText>
          {u.by_feature.map((f: any) => <AppText key={f.feature} style={{ fontSize: 12, paddingVertical: 2 }}><AppText weight="700" style={{ fontSize: 12 }}>{t(FEATURES[f.feature] || f.feature)}</AppText> · {f.requests}{f.errors ? ` · ${f.errors} ${t('errors')}` : ''}</AppText>)}
          <AppText weight="700" style={{ fontSize: 12, marginTop: 12, marginBottom: 4, color: colors.primaryDark }}>{t('Heaviest users')}</AppText>
          {u.top_users.map((x: any) => <AppText key={x.user_id} style={{ fontSize: 12, paddingVertical: 2 }}><AppText weight="700" style={{ fontSize: 12 }}>{x.name}</AppText> · {x.count} {t('requests')}</AppText>)}
        </ChartCard>
      </View>
    </Screen>
  );
}
