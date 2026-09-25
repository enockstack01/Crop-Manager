import React from 'react';
import { ActivityIndicator, Text, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/theme';
import { PressableScale } from './PressableScale';

type Kind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: Kind;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg: Record<Kind, string> = {
    primary: colors.primary,
    secondary: colors.card,
    danger: colors.red,
    ghost: 'transparent',
  };
  const fg: Record<Kind, string> = {
    primary: '#fff',
    secondary: colors.text,
    danger: '#fff',
    ghost: colors.primary,
  };
  const pad =
    size === 'sm'
      ? { minHeight: 38, paddingHorizontal: spacing.md }
      : { minHeight: 50, paddingHorizontal: spacing.lg };

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      feedback={kind === 'ghost' ? 'select' : 'tap'}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderRadius: radius.md,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          backgroundColor: bg[kind],
          opacity: isDisabled ? 0.55 : pressed && kind === 'ghost' ? 0.6 : 1,
        },
        kind === 'primary' || kind === 'danger' ? shadow(isDisabled ? 1 : 2) : null,
        pad,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[kind]} />
      ) : icon ? (
        <MaterialCommunityIcons name={icon as any} size={size === 'sm' ? 16 : 19} color={fg[kind]} />
      ) : null}
      <Text style={{ color: fg[kind], fontWeight: '700', fontSize: size === 'sm' ? 13 : 15, letterSpacing: 0.2 }}>
        {title}
      </Text>
    </PressableScale>
  );
}
