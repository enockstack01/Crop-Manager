import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText } from './ui';

type ToastType = 'success' | 'error' | 'warning' | 'info';
type ToastFn = (message: string, type?: ToastType, duration?: number) => void;

const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

const ICONS: Record<ToastType, string> = {
  success: 'check-circle',
  error: 'close-circle',
  warning: 'alert',
  info: 'information',
};
const COLORS: Record<ToastType, string> = {
  success: '#2E7D32',
  error: '#D32F2F',
  warning: '#F9A825',
  info: '#1976D2',
};

type Item = { id: number; message: string; type: ToastType };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const remove = useCallback((id: number) => setItems((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (message, type = 'success', duration = 3500) => {
      const id = ++idRef.current;
      setItems((t) => [...t, { id, message, type }]);
      if (duration) setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { top: insets.top + spacing.sm, alignItems: 'center' }]}>
        {items.map((t) => (
          <View
            key={t.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderLeftWidth: 3,
              borderLeftColor: COLORS[t.type],
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.sm,
              maxWidth: '92%',
              elevation: 4,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <MaterialCommunityIcons name={ICONS[t.type] as any} size={18} color={COLORS[t.type]} />
            <AppText style={{ flexShrink: 1 }}>{t.message}</AppText>
          </View>
        ))}
      </View>
    </ToastCtx.Provider>
  );
}
