import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, shadow, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { PressableScale } from './PressableScale';

/* ---------------------------------------------------------------- Screen */
export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshControl,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: any;
}) {
  const { colors } = useTheme();
  const pad = padded ? { padding: spacing.lg } : null;
  if (!scroll) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={[{ flexGrow: 1, paddingBottom: spacing.xxl }, pad, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Horizontal scroll container for wide content (charts, tables). */
export function ScreenScrollHost({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.md }}>
      {children}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ Text */
type Variant = 'title' | 'heading' | 'subtitle' | 'body' | 'label' | 'caption';

export function AppText({
  variant = 'body',
  color,
  weight,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; weight?: '400' | '500' | '600' | '700' | '800' }) {
  const { colors } = useTheme();
  const map: Record<Variant, any> = {
    title: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
    heading: { fontSize: font.lg, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: font.md, color: colors.textLight },
    body: { fontSize: font.md, color: colors.text },
    label: { fontSize: font.sm, fontWeight: '600', color: colors.textLight },
    caption: { fontSize: font.xs, color: colors.textLight },
  };
  return (
    <Text
      {...rest}
      style={[map[variant], color ? { color } : null, weight ? { fontWeight: weight } : null, style]}
    />
  );
}

/* ------------------------------------------------------------------ Card */
export function Card({ style, children, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.lg,
          ...shadow(1),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ----------------------------------------------------------------- Badge */
const TONE_BG: Record<string, [string, string]> = {
  success: ['#E8F5E9', '#2E7D32'],
  warning: ['#FFF8E1', '#F57F17'],
  danger: ['#FFEBEE', '#D32F2F'],
  info: ['#E3F2FD', '#1565C0'],
  primary: ['#E8F5E9', '#2E7D32'],
  neutral: ['#EEEEEE', '#616161'],
};

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
}) {
  const [bg, fg] = TONE_BG[tone] ?? TONE_BG.neutral;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm }}>
      <Text style={{ color: fg, fontSize: font.xs, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------- KeyValue */
export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <AppText variant="caption" style={{ textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
        {label}
      </AppText>
      {typeof children === 'string' || typeof children === 'number' ? (
        <AppText variant="body">{String(children || '—')}</AppText>
      ) : (
        children
      )}
    </View>
  );
}

/* ------------------------------------------------------------- SectionTitle */
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <AppText variant="label" style={[{ textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm, marginTop: spacing.md }, style]}>
      {children}
    </AppText>
  );
}

/* ---------------------------------------------------------------- Divider */
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

/* --------------------------------------------------------------- Loading */
export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md }}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <AppText variant="subtitle">{label}</AppText> : null}
    </View>
  );
}

/* -------------------------------------------------------------- Skeleton */
/** Pulsing placeholder block shown while content loads (instead of a bare spinner). */
export function Skeleton({ width = '100%', height = 14, radius: r = radius.sm, style }: {
  width?: number | `${number}%`; height?: number; radius?: number; style?: any;
}) {
  const { colors, isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, opacity: pulse, backgroundColor: isDark ? '#2C2C2C' : colors.border }, style]}
    />
  );
}

/** A column of card-shaped skeleton rows for list screens. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
            borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
          }}
        >
          <Skeleton width="55%" height={15} />
          <Skeleton width="85%" height={11} />
          <Skeleton width={72} height={18} radius={radius.pill} />
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------- EmptyState */
export function EmptyState({
  icon = 'inbox-outline',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <View
        style={{
          width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.primaryLight, marginBottom: spacing.sm,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={34} color={colors.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>{title}</AppText>
      {description ? (
        <AppText variant="subtitle" style={{ textAlign: 'center', maxWidth: 320 }}>{description}</AppText>
      ) : null}
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          accessibilityRole="button"
          style={{
            marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.xl,
            minHeight: 46, justifyContent: 'center', borderRadius: radius.md, ...shadow(2),
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------- IconButton */
export function IconButton({
  name,
  onPress,
  color,
  size = 20,
  disabled,
}: {
  name: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      android_ripple={{ color: colors.primaryLight, borderless: true, radius: 22 }}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.35 : 1, backgroundColor: pressed ? colors.primaryLight : 'transparent',
      })}
    >
      <MaterialCommunityIcons name={name as any} size={size} color={color ?? colors.textLight} />
    </Pressable>
  );
}
