import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { CALCULATORS } from '../lib/calculators';
import { useList, useResourceMutations } from '../lib/useResource';
import { formatDateTime } from '../lib/format';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius, shadow } from '../theme/theme';
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
  const [q, setQ] = useState('');
  const shown = CALCULATORS.filter((c) => !q.trim() || `${t(c.title)} ${t(c.desc)} ${c.title}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Screen>
      <PageHeader title="Agricultural Calculators" subtitle="Quick field-planning tools." />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, minHeight: 42, marginBottom: 16 }}>
        <Icon name="magnifying-glass" size={13} color={colors.placeholder} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('Search calculators...')} placeholderTextColor={colors.placeholder} style={{ flex: 1, paddingVertical: 8, color: colors.text, fontSize: 13, fontFamily: ff('400') }} />
      </View>
      {shown.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight, marginBottom: 12 }}>{t('No calculator matches your search.')}</AppText> : null}
      <Grid columns={columns} gap={16}>
        {shown.map((c) => (
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
            <View style={{ marginTop: 8, backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <AppText weight="700" style={{ fontSize: 10, color: '#1C2B1E' }}>{t('Fills from your farm, explains the result')}</AppText>
            </View>
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
