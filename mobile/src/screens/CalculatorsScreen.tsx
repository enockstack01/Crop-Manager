import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CALCULATORS } from '../lib/calculators';
import { useList, useResourceMutations } from '../lib/useResource';
import { formatDateTime } from '../lib/format';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText, Card, IconButton, Screen, SectionTitle } from '../components/ui';

export function CalculatorsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data } = useList('calculation-history', { perPage: 20, sort: 'created_at', order: 'desc' });
  const { remove } = useResourceMutations('calculation-history');
  const history = data?.data ?? [];

  return (
    <Screen>
      <AppText variant="subtitle">Quick field-planning tools.</AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
        {CALCULATORS.map((c) => (
          <Pressable
            key={c.type}
            onPress={() => navigation.navigate('calculator-detail', { type: c.type })}
            style={{
              width: '48%', backgroundColor: colors.card, borderRadius: radius.md,
              borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name={c.icon as any} size={20} color={colors.primary} />
            </View>
            <AppText weight="700">{c.title}</AppText>
            <AppText variant="caption" numberOfLines={2}>{c.desc}</AppText>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Recent Calculations</SectionTitle>
      <Card style={{ padding: 0 }}>
        {history.length === 0 ? (
          <View style={{ padding: spacing.lg }}>
            <AppText variant="caption" style={{ textAlign: 'center' }}>No calculation history yet</AppText>
          </View>
        ) : (
          history.map((h: any, i: number) => {
            const calc = CALCULATORS.find((c) => c.type === h.calculator_type);
            return (
              <View
                key={h.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  padding: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText weight="600">{calc?.title || h.calculator_type}</AppText>
                  <AppText variant="caption">{formatDateTime(h.created_at)}</AppText>
                </View>
                <IconButton name="restore" onPress={() => navigation.navigate('calculator-detail', { type: h.calculator_type, reopen: h.inputs })} />
                <IconButton
                  name="trash-can-outline"
                  color={colors.red}
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
      </Card>
    </Screen>
  );
}
