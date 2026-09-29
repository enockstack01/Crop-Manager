import React from 'react';
import { ActivityIndicator, Text, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius } from '../theme/theme';
import { PressableScale } from './PressableScale';

type Kind = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * web .btn / .btn-primary / .btn-secondary / .btn-danger / .btn-sm:
 * 8px radius, Inter 600 13px, icon before the label. Touch height is kept at 44px
 * (web buttons are ~40px) so they stay comfortable to tap.
 */
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
  const border: Record<Kind, string> = {
    primary: colors.primary,
    secondary: colors.border,
    danger: colors.red,
    ghost: 'transparent',
  };
  const sm = size === 'sm';

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      feedback={kind === 'ghost' ? 'select' : 'tap'}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: border[kind],
          backgroundColor: bg[kind],
          minHeight: sm ? 36 : 44,
          paddingHorizontal: sm ? 14 : 18,
          opacity: isDisabled ? 0.6 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[kind]} />
      ) : icon ? (
        <Icon name={icon} size={sm ? 12 : 13} color={fg[kind]} />
      ) : null}
      <Text style={{ color: fg[kind], fontFamily: ff('600'), fontSize: sm ? 12 : 13 }}>{title}</Text>
    </PressableScale>
  );
}
