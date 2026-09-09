import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CALCULATOR_BY_TYPE, CalcResult } from '../lib/calculators';
import { useResourceMutations } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText, Card, EmptyState, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { NumberField, SelectField } from '../components/fields';

export function CalculatorDetailScreen({ route }: any) {
  const { colors } = useTheme();
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
      <AppText variant="subtitle">{calc.desc}</AppText>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
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

        <Button title="Calculate" icon="calculator" onPress={() => setResult(calc.compute(values))} />

        {result ? (
          <Card style={{ backgroundColor: colors.primaryLight, borderColor: colors.primary }}>
            <AppText weight="800" style={{ marginBottom: spacing.sm }}>Result</AppText>
            {result.map((r) => (
              <View
                key={r.label}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: spacing.md }}
              >
                <AppText variant="caption" style={{ flex: 1 }}>{r.label}</AppText>
                <AppText weight="700" style={{ flexShrink: 1, textAlign: 'right' }}>{r.value}</AppText>
              </View>
            ))}
          </Card>
        ) : null}

        {result ? (
          <Button title="Save to history" kind="secondary" icon="content-save" onPress={save} />
        ) : null}

        <View
          style={{
            backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
            padding: spacing.md, marginTop: spacing.sm,
          }}
        >
          <AppText variant="caption">
            These calculators provide estimates for planning purposes. Always verify against agronomic
            recommendations for your specific crop, soil and conditions.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}
