import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { AppText } from './ui';
import { DateField } from './fields';
import { useToast } from './Toast';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { PERIODS, Period, PeriodId, periodRange } from '../lib/period';
import type { ExportFormat } from '../lib/exports';
import { t } from '../i18n';

const FORMATS: { id: ExportFormat; label: string; icon: string }[] = [
  { id: 'pdf', label: 'PDF document', icon: 'file-pdf' },
  { id: 'xlsx', label: 'Excel workbook (.xlsx)', icon: 'file-excel' },
  { id: 'csv', label: 'CSV (spreadsheet text)', icon: 'file-csv' },
];

/**
 * "Export" button: pick the recording period (everything by default), then PDF, Excel or CSV.
 * `run(format, { from, to })` builds and shares the file; the period is empty for "All time".
 * Reports pass nothing for `period` because they have their own date filters.
 */
export function ExportButton({
  run, disabled, size = 'md', period = false,
}: { run: (format: ExportFormat, period: Period) => Promise<unknown>; disabled?: boolean; size?: 'sm' | 'md'; period?: boolean }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [choice, setChoice] = useState<PeriodId>('all');
  const [custom, setCustom] = useState<Period>({});
  const range = periodRange(choice, custom);
  const bad = choice === 'custom' && !!range.from && !!range.to && range.from > range.to;

  const go = async (f: ExportFormat) => {
    if (bad) { toast(t('The start of the period is after its end.'), 'error'); return; }
    haptics.select();
    setBusy(f);
    try {
      await run(f, range);
      setOpen(false);
    } catch (e: any) {
      toast(e?.message || t('Could not export'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button title="Export" icon="download" kind="secondary" size={size} disabled={disabled} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => !busy && setOpen(false)} title="Export" size="sm">
        <View style={{ gap: spacing.sm }}>
          {period ? (
            <View style={{ gap: 8, marginBottom: 6 }}>
              <AppText weight="700" style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textLight }}>{t('Recording period')}</AppText>
              <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {PERIODS.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setChoice(p.id)}
                    accessibilityRole="button"
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: choice === p.id ? colors.primaryDark : colors.border, backgroundColor: choice === p.id ? colors.primaryDark : colors.card }}
                  >
                    <AppText weight="600" style={{ fontSize: 12, color: choice === p.id ? '#fff' : colors.text }}>{t(p.label)}</AppText>
                  </Pressable>
                ))}
              </ScrollView>
              {choice === 'custom' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><DateField label="From" value={custom.from || ''} onChangeValue={(v) => setCustom((c) => ({ ...c, from: v }))} /></View>
                  <View style={{ flex: 1 }}><DateField label="To" value={custom.to || ''} onChangeValue={(v) => setCustom((c) => ({ ...c, to: v }))} /></View>
                </View>
              ) : choice !== 'all' && range.from && range.to ? (
                <AppText style={{ fontSize: 12, color: colors.textLight }}>{range.from} → {range.to}</AppText>
              ) : null}
            </View>
          ) : null}
          {FORMATS.map((f) => (
            <Pressable
              key={f.id}
              disabled={!!busy}
              onPress={() => go(f.id)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1,
                borderColor: colors.border, backgroundColor: pressed ? colors.bg : colors.card, opacity: busy && busy !== f.id ? 0.5 : 1,
              })}
            >
              <Icon name={busy === f.id ? 'spinner' : f.icon} size={16} color={colors.primary} />
              <AppText weight="600" style={{ fontSize: 14 }}>{busy === f.id ? t('Preparing…') : t(f.label)}</AppText>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </>
  );
}
