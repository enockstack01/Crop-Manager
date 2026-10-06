import React from 'react';
import { View } from 'react-native';
import { Icon } from '../components/Icon';
import { CALCULATORS } from '../lib/calculators';
import { useList, useResourceMutations } from '../lib/useResource';
import { formatDateTime } from '../lib/format';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow } from '../theme/theme';
import { AppText, ChartCard, Grid, IconButton, PageHeader, Screen, useLayout } from '../components/ui';
import { PressableScale } from '../components/PressableScale';
import { t } from '../i18n';

/** web Calculators page: centred .calc-card grid (icon tile, title, description) + history. */
export function CalculatorsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { columns } = useLayout();
  const toast = useToast();
  const confirm = useConfirm();
  const { data } = useList('calculation-history', { perPage: 20, sort: 'created_at', order: 'desc' });
  const { remove } = useResourceMutations('calculation-history');
  const history = data?.data ?? [];

  return (
    <Screen>
      <PageHeader title="Agricultural Calculators" subtitle="Quick field-planning tools." />

      <Grid columns={columns} gap={16}>
        {CALCULATORS.map((c) => (
          <PressableScale
            key={c.type}
            onPress={() => navigation.navigate('calculator-detail', { type: c.type })}
            accessibilityRole="button"
            accessibilityLabel={c.title}
            style={({ pressed }) => ({
              alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
              borderColor: pressed ? colors.primary : colors.border, paddingVertical: 24, paddingHorizontal: 20,
              ...shadow(pressed ? 2 : 1),
            })}
          >
            <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon name={c.icon} size={20} color={colors.primary} />
            </View>
            <AppText weight="600" style={{ fontSize: 14, textAlign: 'center', marginBottom: 6 }}>{c.title}</AppText>
            <AppText style={{ fontSize: 12, lineHeight: 18, color: colors.textLight, textAlign: 'center' }}>{c.desc}</AppText>
          </PressableScale>
        ))}
      </Grid>

      <ChartCard title="Recent Calculations" icon="clock" style={{ marginTop: 24 }} bodyStyle={{ padding: 0 }}>
        {history.length === 0 ? (
          <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', padding: 24 }}>{t('No calculation history yet')}</AppText>
        ) : (
          history.map((h: any, i: number) => {
            const calc = CALCULATORS.find((c) => c.type === h.calculator_type);
            return (
              <View
                key={h.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingLeft: 20, paddingRight: 10,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText weight="600" style={{ fontSize: 13 }}>{calc?.title || h.calculator_type}</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>{formatDateTime(h.created_at)}</AppText>
                </View>
                <IconButton name="restore" color={colors.blue} label="Reopen" onPress={() => navigation.navigate('calculator-detail', { type: h.calculator_type, reopen: h.inputs })} />
                <IconButton
                  name="trash-can"
                  color={colors.red}
                  label="Delete"
                  onPress={async () => {
                    if (await confirm('Delete this calculation from history?')) {
                      await remove.mutateAsync(h.id);
                      toast('Deleted from history');
                    }
                  }}
                />
              </View>
            );
          })
        )}
      </ChartCard>
    </Screen>
  );
}
