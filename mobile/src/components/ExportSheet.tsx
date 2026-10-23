import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { AppText } from './ui';
import { useToast } from './Toast';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
import type { ExportFormat } from '../lib/exports';
import { t } from '../i18n';

const FORMATS: { id: ExportFormat; label: string; icon: string }[] = [
  { id: 'pdf', label: 'PDF document', icon: 'file-pdf' },
  { id: 'xlsx', label: 'Excel workbook (.xlsx)', icon: 'file-excel' },
  { id: 'csv', label: 'CSV (spreadsheet text)', icon: 'file-csv' },
];

/** "Export" button with a PDF / Excel / CSV choice; `run(format)` builds and shares the file. */
export function ExportButton({ run, disabled, size = 'md' }: { run: (format: ExportFormat) => Promise<unknown>; disabled?: boolean; size?: 'sm' | 'md' }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const go = async (f: ExportFormat) => {
    haptics.select();
    setBusy(f);
    try {
      await run(f);
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
