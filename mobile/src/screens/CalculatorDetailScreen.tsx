import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CALCULATOR_BY_TYPE, CalcResult } from '../lib/calculators';
import { useResourceMutations } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText, EmptyState, PageHeader, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { NumberField, SelectField } from '../components/fields';

export function CalculatorDetailScreen({ route }: any) {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const type: string = route.params?.type;
  const reopen: Record<string, any> | undefined = route.params?.reopen;
  const calc = CALCULATOR_BY_TYPE[type];
  const { create } = useResourceMutations('calculation-history');

  const initial = useMemo(() => {
    const base: Record<string, any> = {};
    for (const f of calc?.fields ?? []) base[f.name] = f.default ?? '';
    return { ...base, ...(reopen || {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const [values, setValues] = useState<Record<string, any>>(initial);
  const [result, setResult] = useState<CalcResult[] | null>(reopen && calc ? calc.compute(initial) : null);

  if (!calc) {
    return (
      <Screen>
        <EmptyState icon="calculator" title="Calculator not found" />
      </Screen>
    );
  }

  const set = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  const save = async () => {
    try {
      await create.mutateAsync({ calculator_type: type, inputs: values, result });
      toast('Calculation saved to history', 'info');
    } catch (e: any) {
      toast(e?.message || 'Failed to save', 'error');
    }
  };

  return (
    <Screen>
      <PageHeader title={calc.title} subtitle={calc.desc} />

      {/* .calc-form */}
      <View style={{ gap: 18, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 24, maxWidth: 600, width: '100%' }}>
        {calc.fields.map((f) =>
          f.type === 'select' ? (
            <SelectField
              key={f.name}
              label={f.label}
              value={values[f.name]}
              onChangeValue={(v) => set(f.name, v)}
              options={f.options ?? []}
              placeholder=""
            />
          ) : (
            <NumberField key={f.name} label={f.label} value={values[f.name]} onChangeValue={(v) => set(f.name, v)} />
          ),
        )}

        <View style={{ alignSelf: 'flex-start' }}>
          <Button title="Calculate" icon="calculator" onPress={() => setResult(calc.compute(values))} />
        </View>

        {result ? (
          <View
            style={{
              backgroundColor: isDark ? '#1A3D1E' : colors.primaryLight, borderWidth: 1, borderColor: isDark ? '#2E5A32' : '#C8E6C9',
              borderRadius: radius.lg, padding: 20,
            }}
          >
            <AppText weight="600" style={{ fontSize: 13, color: isDark ? '#A5D6A7' : colors.primaryDark, marginBottom: 12 }}>Result</AppText>
            {result.map((r, i) => (
              <View
                key={r.label}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: spacing.md,
                  borderBottomWidth: i === result.length - 1 ? 0 : 1, borderBottomColor: 'rgba(46,125,50,0.1)',
                }}
              >
                <AppText style={{ fontSize: 13, color: colors.textLight, flex: 1 }}>{r.label}</AppText>
                <AppText weight="700" style={{ fontSize: 13, flexShrink: 1, textAlign: 'right' }}>{r.value}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {result ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button title="Save to history" kind="secondary" icon="content-save" onPress={save} />
          </View>
        ) : null}

        {/* .calc-disclaimer */}
        <View
          style={{
            backgroundColor: isDark ? '#3D3420' : '#FFF8E1', borderRadius: radius.md, borderWidth: 1,
            borderColor: isDark ? '#5D4A20' : '#FFE082', padding: 12,
          }}
        >
          <AppText style={{ fontSize: 11, lineHeight: 17, color: colors.textLight }}>
            These calculators provide estimates for planning purposes. Always verify against agronomic
            recommendations for your specific crop, soil and conditions.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}
