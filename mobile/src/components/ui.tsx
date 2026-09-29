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
  useWindowDimensions,
  View,
  ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { ff, font, KPI_TONES, radius, shadow, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { PressableScale } from './PressableScale';

/*
 * UI kit mirroring the web app's CSS (client/src/styles): same type scale, card,
 * badge, empty-state and page-header styles, with responsive columns for tablets.
 */

/* ------------------------------------------------------------ responsive */
/** Breakpoints matching the web's responsive.css (480 / 768 / 1024). */
export function useLayout() {
  const { width } = useWindowDimensions();
  return {
    width,
    isPhone: width < 768,
    isTablet: width >= 768,
    isWide: width >= 1024,
    /** columns for card grids (KPIs, calculators, report tiles) */
    columns: width >= 1024 ? 3 : width >= 600 ? 2 : 1,
    /** horizontal page padding — web .main-content-inner: 16px mobile, 28px desktop */
    gutter: width >= 768 ? 28 : spacing.lg,
  };
}

/** Lays children out in N equal columns (1 on phones), wrapping onto new rows. */
export function Grid({ columns, gap = spacing.lg, children, style }: { columns: number; gap?: number; children: React.ReactNode; style?: any }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (columns <= 1) return <View style={[{ gap }, style]}>{items}</View>;
  const rows: React.ReactNode[][] = [];
  items.forEach((child, i) => {
    if (i % columns === 0) rows.push([]);
    rows[rows.length - 1].push(child);
  });
  return (
    <View style={[{ gap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((child, c) => (
            <View key={c} style={{ flex: 1, minWidth: 0 }}>{child}</View>
          ))}
          {Array.from({ length: columns - row.length }, (_, k) => <View key={`pad${k}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

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
  const { gutter, isWide } = useLayout();
  const pad = padded ? { paddingHorizontal: gutter, paddingTop: 20 } : null;
  // web .main-content-inner caps content at 1400px
  const cap = isWide ? { maxWidth: 1400, width: '100%' as const, alignSelf: 'center' as const } : null;
  if (!scroll) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[{ flex: 1 }, pad, cap, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={[{ flexGrow: 1, paddingBottom: spacing.xxl }, pad, cap, contentStyle]}
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
type Weight = '400' | '500' | '600' | '700' | '800';

export function AppText({
  variant = 'body',
  color,
  weight,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; weight?: Weight }) {
  const { colors } = useTheme();
  // web: .page-title 24/700, .card-header h3 15/600, .page-subtitle 14, body 13-14,
  // .form-label 12/600, small print 11
  const map: Record<Variant, { size: number; weight: Weight; color: string }> = {
    title: { size: font.xxl, weight: '700', color: colors.text },
    heading: { size: font.lg, weight: '600', color: colors.text },
    subtitle: { size: font.base, weight: '400', color: colors.textLight },
    body: { size: font.base, weight: '400', color: colors.text },
    label: { size: font.sm, weight: '600', color: colors.text },
    caption: { size: font.xs, weight: '400', color: colors.textLight },
  };
  const v = map[variant];
  const w = weight ?? v.weight;
  // explicit style fontWeight still selects the matching Inter face
  const flat = StyleSheet.flatten(style) as any;
  const family = ff(flat?.fontWeight ?? w);
  return (
    <Text
      {...rest}
      style={[
        { fontSize: v.size, color: v.color, lineHeight: Math.round(v.size * 1.45) },
        color ? { color } : null,
        style,
        { fontFamily: family, fontWeight: undefined },
      ]}
    />
  );
}

/* ------------------------------------------------------------ PageHeader */
/** web .page-title + .page-subtitle (+ an optional action under it, like "Add Farm"). */
export function PageHeader({ title, subtitle, action, right }: { title: string; subtitle?: string; action?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ lineHeight: 31 }}>{title}</AppText>
          {subtitle ? <AppText variant="subtitle" style={{ marginTop: 4 }}>{subtitle}</AppText> : null}
        </View>
        {right}
      </View>
      {action ? <View style={{ alignSelf: 'flex-start' }}>{action}</View> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ Card */
/** web .card: white, 1px border, radius 10, soft shadow */
export function Card({ style, children, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
          ...shadow(1),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** web .chart-card: header (icon + 15/600 title, bottom border) and padded body. */
export function ChartCard({
  title,
  icon,
  iconColor,
  right,
  children,
  bodyStyle,
  style,
}: {
  title: string;
  icon?: string;
  iconColor?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  bodyStyle?: any;
  style?: any;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow(1) },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
        }}
      >
        {icon ? <Icon name={icon} size={15} color={iconColor ?? colors.primary} /> : null}
        <AppText weight="600" style={{ fontSize: 15, flex: 1 }} numberOfLines={2}>{title}</AppText>
        {right}
      </View>
      <View style={[{ padding: 20 }, bodyStyle]}>{children}</View>
    </View>
  );
}

/** web .kpi-card: coloured icon square, label, large value; tappable. */
export function KpiCard({
  icon,
  tone = 'green',
  label,
  value,
  onPress,
}: {
  icon: string;
  tone?: keyof typeof KPI_TONES;
  label: string;
  value: string | number;
  onPress?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [bgLight, bgDark, fg] = KPI_TONES[tone];
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: 14,
        backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        paddingVertical: 18, paddingHorizontal: 20, ...shadow(1),
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: isDark ? bgDark : bgLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color={fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText weight="500" style={{ fontSize: 12, color: colors.textLight, marginBottom: 4 }} numberOfLines={1}>{label}</AppText>
        <AppText weight="700" style={{ fontSize: 24, lineHeight: 29 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {String(value)}
        </AppText>
      </View>
    </PressableScale>
  );
}

/** Centered label / value / unit tile (web Reports & dashboard tiles). */
export function StatTile({ label, value, sub, color, tone }: { label: string; value: string | number; sub?: string; color?: string; tone?: 'green' | 'orange' | 'blue' }) {
  const { colors, isDark } = useTheme();
  const bg = tone ? (isDark ? KPI_TONES[tone][1] : KPI_TONES[tone][0]) : colors.bg;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' }}>
      <AppText weight="600" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </AppText>
      <AppText weight="800" style={{ fontSize: 22, lineHeight: 28, color: color ?? colors.text, marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {String(value)}
      </AppText>
      {sub ? <AppText style={{ fontSize: 11, color: colors.textLight }}>{sub}</AppText> : null}
    </View>
  );
}

/* ----------------------------------------------------------------- Badge */
/** web .badge-*: 11/600, radius 6, tinted background */
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
}) {
  const { colors, isDark } = useTheme();
  const tones: Record<string, [string, string]> = {
    success: [isDark ? '#1A3D1E' : '#E8F5E9', isDark ? '#81C784' : '#2E7D32'],
    warning: [isDark ? '#3D3420' : '#FFF8E1', isDark ? '#FFD54F' : '#F57F17'],
    danger: [isDark ? '#3D1A1A' : '#FFEBEE', isDark ? '#EF9A9A' : '#D32F2F'],
    info: [isDark ? '#1A3A5C' : '#E3F2FD', isDark ? '#90CAF9' : '#1565C0'],
    primary: [colors.primaryLight, isDark ? '#81C784' : colors.primary],
    neutral: [colors.bg, colors.textLight],
  };
  const [bg, fg] = tones[tone] ?? tones.neutral;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm }}>
      <Text style={{ color: fg, fontSize: 11, fontFamily: ff('600') }}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------- KeyValue */
export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
        {label}
      </AppText>
      {typeof children === 'string' || typeof children === 'number' ? (
        <AppText style={{ fontSize: 13 }}>{String(children || '—')}</AppText>
      ) : (
        children
      )}
    </View>
  );
}

/* ------------------------------------------------------------- SectionTitle */
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  return (
    <AppText weight="700" style={[{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: 20 }, style]}>
      {children}
    </AppText>
  );
}

/* ---------------------------------------------------------------- Divider */
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

/* --------------------------------------------------------------- Loading */
/** web .loading-state: spinner + muted label */
export function Loading({ label = 'Loading data...' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <AppText variant="subtitle" style={{ fontSize: 13 }}>{label}</AppText> : null}
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

/** Table-shaped skeleton rows for list screens (web .table-responsive look). */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ padding: 16, gap: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="80%" height={11} />
          <Skeleton width={70} height={18} radius={radius.sm} />
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------- EmptyState */
/** web .empty-state: tinted icon circle, 16/600 title, muted text, primary action */
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
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl, gap: spacing.sm }}>
      <View
        style={{
          width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.primaryLight, marginBottom: spacing.sm,
        }}
      >
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <AppText weight="600" style={{ fontSize: 16, textAlign: 'center' }}>{title}</AppText>
      {description ? (
        <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', maxWidth: 340 }}>{description}</AppText>
      ) : null}
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          accessibilityRole="button"
          style={{
            marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: 18,
            minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md,
          }}
        >
          <Icon name="plus" size={13} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: ff('600'), fontSize: 13 }}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------- IconButton */
/** web .btn-icon: 34px, radius 8, muted icon; tinted on press */
export function IconButton({
  name,
  onPress,
  color,
  size = 14,
  disabled,
  label,
}: {
  name: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label ?? name}
      style={({ pressed }) => ({
        width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.35 : 1, backgroundColor: pressed ? colors.bg : 'transparent',
      })}
    >
      <Icon name={name} size={size} color={color ?? colors.textLight} />
    </Pressable>
  );
}
