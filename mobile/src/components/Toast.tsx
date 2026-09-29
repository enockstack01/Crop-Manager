import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
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
const FEEDBACK: Record<ToastType, () => void> = {
  success: haptics.success,
  error: haptics.error,
  warning: haptics.warning,
  info: haptics.select,
};

type Item = { id: number; message: string; type: ToastType; duration: number };

function ToastItem({ item, onDone }: { item: Item; onDone: (id: number) => void }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onDone(item.id));
  }, [anim, item.id, onDone]);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    const t = item.duration ? setTimeout(close, item.duration) : undefined;
    return () => clearTimeout(t);
  }, [anim, close, item.duration]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        maxWidth: '92%',
        marginBottom: spacing.sm,
      }}
    >
      <Pressable
        onPress={close}
        accessibilityRole="alert"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          ...shadow(3),
        }}
      >
        <Icon name={ICONS[item.type] as any} size={20} color={COLORS[item.type]} />
        <AppText weight="600" style={{ flexShrink: 1 }}>{item.message}</AppText>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();

  const remove = useCallback((id: number) => setItems((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastFn>((message, type = 'success', duration = 3500) => {
    const id = ++idRef.current;
    FEEDBACK[type]();
    // keep at most three on screen
    setItems((t) => [...t.slice(-2), { id, message, type, duration }]);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { top: insets.top + spacing.sm, alignItems: 'center' }]}>
        {items.map((t) => (
          <ToastItem key={t.id} item={t} onDone={remove} />
        ))}
      </View>
    </ToastCtx.Provider>
  );
}
