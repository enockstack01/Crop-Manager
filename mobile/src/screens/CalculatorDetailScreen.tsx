import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CALCULATOR_BY_TYPE, CalcResult } from '../lib/calculators';
import { aiCalculatorReport } from '../lib/ai';
import { shareCalculatorPdf } from '../lib/pdfReport';
import { useProfile, useResourceMutations } from '../lib/useResource';
import { displayName } from '../lib/format';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText, EmptyState, PageHeader, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { NumberField, SelectField } from '../components/fields';
import { t } from '../i18n';

/** Calculators that take an area, which a field of the farmer's can fill in. */
const AREA_CALCS = ['fertilizer', 'seed-rate', 'plant-population', 'irrigation', 'rainfall', 'yield', 'crop-spacing'];

export function CalculatorDetailScreen({ route }: any) {
  const { colors } = useTheme();
  const toast = useToast();
  const { profile } = useProfile();
  const type: string = route.params?.type;
  const reopen: Record<string, any> | undefined = route.params?.reopen;
  const calc = CALCULATOR_BY_TYPE[type];
  const { create } = useResourceMutations('calculation-history');
  const { data: ctx } = useQuery({ queryKey: ['calc-context'], queryFn: () => api.get('/calculators/context').then((r) => r.data), staleTime: 5 * 60 * 1000 });

  const initial = useMemo(() => {
    const base: Record<string, any> = {};
    for (const f of calc?.fields ?? []) base[f.name] = f.default ?? '';
    return { ...base, ...(reopen || {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const [values, setValues] = useState<Record<string, any>>(initial);
  const [result, setResult] = useState<CalcResult[] | null>(reopen && calc ? calc.compute(initial) : null);
  const [fieldId, setFieldId] = useState('');
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!calc) {
    return (
      <Screen>
        <EmptyState icon="calculator" title="Calculator not found" />
      </Screen>
    );
  }

  const set = (name: string, v: any) => { setValues((prev) => ({ ...prev, [name]: v })); setReport(null); };
  const setMany = (patch: Record<string, any>) => { setValues((prev) => ({ ...prev, ...patch })); setReport(null); };
  const field = ctx?.fields?.find((f: any) => f.id === fieldId);
  const water = ctx?.water;
  const has = (n: string) => calc.fields.some((f) => f.name === n);

  const pickField = (id: string) => {
    setFieldId(id);
    const f = ctx?.fields?.find((x: any) => x.id === id);
    if (f?.area_ha && AREA_CALCS.includes(type)) {
      const patch: Record<string, any> = { area: String(f.area_ha) };
      if (has('unit')) patch.unit = 'hectares';
      if (has('areaUnit')) patch.areaUnit = 'hectares';
      setMany(patch);
    }
  };

  const save = async () => {
    try {
      await create.mutateAsync({ calculator_type: type, inputs: values, result });
      toast('Calculation saved to history', 'info');
    } catch (e: any) {
      toast(e?.message || 'Failed to save', 'error');
    }
  };

  const inputRows = (): [string, any][] => calc.fields.filter((f) => values[f.name] !== '' && values[f.name] != null).map((f) => [f.label, values[f.name]]);

  const explain = async () => {
    setBusy(true);
    setErr('');
    try {
      const out = await aiCalculatorReport({ type: calc.title, inputs: Object.fromEntries(inputRows()), results: result, field_name: field?.name });
      setReport(out.report);
    } catch (e: any) {
      setErr(e?.message || t('The assistant could not explain this now. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const pdf = async () => {
    setPdfBusy(true);
    try {
      await shareCalculatorPdf({ title: t(calc.title), inputs: inputRows(), results: result || [], report, owner: [displayName(profile), profile?.public_id].filter(Boolean).join(' · '), field: field?.name });
    } catch (e: any) {
      toast(e?.message || t('Could not create the PDF'), 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const assist = { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, backgroundColor: colors.primaryLight, gap: 8 } as const;

  return (
    <Screen>
      <PageHeader title={calc.title} subtitle={calc.desc} />

      {/* .calc-form */}
      <View style={{ gap: 18, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 24, maxWidth: 760, width: '100%' }}>
        {AREA_CALCS.includes(type) && ctx?.fields?.length ? (
          <View style={assist}>
            <SelectField
              label="Use one of my fields"
              value={fieldId}
              onChangeValue={pickField}
              placeholder="Choose a field to fill the area"
              options={ctx.fields.map((f: any) => ({ value: f.id, label: `${f.name}${f.farm ? ` · ${f.farm}` : ''}${f.area_ha ? ` · ${f.area_ha} ha` : ''}${f.crop ? ` · ${f.crop}` : ''}` }))}
            />
            {field ? <AppText style={{ fontSize: 11, color: colors.textLight }}>{[field.crop && `${t('Growing')}: ${field.crop}`, field.soil && `${t('Soil')}: ${field.soil}`, field.soil_ph != null && `pH ${field.soil_ph}`].filter(Boolean).join(' · ')}</AppText> : null}
          </View>
        ) : null}

        {water && type === 'irrigation' ? (
          <View style={assist}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="cloud-sun-rain" size={16} color={colors.primary} />
              <AppText weight="700" style={{ fontSize: 13, flex: 1 }}>{t('Weather water plan for {{place}}', { place: water.location })}</AppText>
            </View>
            <AppText style={{ fontSize: 12 }}>{t('This week plants use about {{use}} mm and about {{rain}} mm of rain is useful: irrigate about {{need}} mm.', { use: water.crop_water_use_mm, rain: water.expected_useful_rain_mm, need: water.irrigation_needed_mm })}</AppText>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button title={t('Use {{n}} mm', { n: water.irrigation_needed_mm })} kind="secondary" size="sm" onPress={() => setMany({ depth: String(water.irrigation_needed_mm) })} />
            </View>
          </View>
        ) : null}

        {water && type === 'rainfall' ? (
          <View style={assist}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="cloud-sun-rain" size={16} color={colors.primary} />
              <AppText weight="700" style={{ fontSize: 13, flex: 1 }}>{t('Rain at {{place}}', { place: water.location })}</AppText>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {water.rain_past_7d_mm != null ? <Button title={t('Last 7 days: {{n}} mm', { n: water.rain_past_7d_mm })} kind="secondary" size="sm" onPress={() => setMany({ depth: String(water.rain_past_7d_mm) })} /> : null}
              <Button title={t('Next 3 days: {{n}} mm', { n: water.rain_next_3_days_mm })} kind="secondary" size="sm" onPress={() => setMany({ depth: String(water.rain_next_3_days_mm) })} />
            </View>
          </View>
        ) : null}

        {calc.fields.map((f) =>
          f.type === 'select' ? (
            <SelectField key={f.name} label={f.label} value={values[f.name]} onChangeValue={(v) => set(f.name, v)} options={f.options ?? []} placeholder="" />
          ) : (
            <NumberField key={f.name} label={f.label} value={values[f.name]} onChangeValue={(v) => set(f.name, v)} />
          ),
        )}

        <View style={{ alignSelf: 'flex-start' }}>
          <Button title="Calculate" icon="calculator" onPress={() => { setResult(calc.compute(values)); setReport(null); setErr(''); }} />
        </View>

        {result ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: 20 }}>
            <AppText weight="600" style={{ fontSize: 13, color: colors.primaryDark, marginBottom: 12 }}>{t('Result')}</AppText>
            {result.map((r, i) => (
              <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: spacing.md, borderBottomWidth: i === result.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                <AppText style={{ fontSize: 13, color: colors.textLight, flex: 1 }}>{t(r.label)}</AppText>
                <AppText weight="700" style={{ fontSize: 13, flexShrink: 1, textAlign: 'right' }}>{r.value}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {result ? (
          <View style={{ gap: 8, alignItems: 'flex-start' }}>
            <Button title={busy ? 'Working...' : 'Explain with my farm data'} icon="wand-magic-sparkles" loading={busy} onPress={explain} />
            <Button title="Save to history" kind="secondary" icon="floppy-disk" onPress={save} />
            <Button title="Download report (PDF)" kind="secondary" icon="file-pdf" loading={pdfBusy} onPress={pdf} />
            {err ? <AppText style={{ fontSize: 12, color: colors.red }}>{err}</AppText> : null}
          </View>
        ) : null}

        {report ? <CalcReport r={report} /> : null}

        {/* .calc-disclaimer */}
        <View style={{ backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.orange, padding: 12 }}>
          <AppText style={{ fontSize: 11, lineHeight: 17, color: colors.textLight }}>
            {t('These calculators provide estimates for planning purposes. Always verify against agronomic recommendations for your specific crop, soil and conditions.')}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

function CalcReport({ r }: { r: any }) {
  const { colors } = useTheme();
  const head = (s: string) => <AppText weight="700" style={{ fontSize: 13, color: colors.primaryDark, marginTop: 12, marginBottom: 4 }}>{t(s)}</AppText>;
  const p = (s: string, i?: number) => <AppText key={i} style={{ fontSize: 13, lineHeight: 19, marginBottom: 4 }}>{s}</AppText>;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.orange, borderRadius: radius.md, padding: 16, backgroundColor: colors.card }}>
      <AppText weight="700" style={{ fontSize: 15, color: colors.primaryDark }}>{r.headline}</AppText>
      {r.meaning?.length ? <>{head('What the results mean')}{r.meaning.map((m: any, i: number) => p(`${m.result}. ${m.explanation}`, i))}</> : null}
      {r.estimates?.length ? <>{head('Other estimates')}{r.estimates.map((e: any, i: number) => p(`${e.label}: ${e.value}${e.note ? ` (${e.note})` : ''}`, i))}</> : null}
      {r.recommendations?.length ? <>{head('Recommended steps')}{r.recommendations.map((x: any, i: number) => p(`${i + 1}. ${x.action}${x.detail ? ` — ${x.detail}` : ''}`, i))}</> : null}
      {r.farm_link ? <>{head('Your farm')}{p(r.farm_link)}</> : null}
      {r.weather_note ? <>{head('Weather')}{p(r.weather_note)}</> : null}
      {r.cautions?.length ? <>{head('Watch out for')}{r.cautions.map((x: string, i: number) => p(`• ${x}`, i))}</> : null}
      {r.assumptions?.length ? <>{head('Assumptions')}{r.assumptions.map((x: string, i: number) => p(`• ${x}`, i))}</> : null}
    </View>
  );
}
