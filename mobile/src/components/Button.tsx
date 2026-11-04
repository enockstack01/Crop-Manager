import React from 'react';
import { ActivityIndicator, Text, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { AMBER, FOREST, ff, radius } from '../theme/theme';
import { PressableScale } from './PressableScale';
import { useOnBanner } from './banner';
import { t } from '../i18n';

type Kind = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * App buttons: pill shape, Carlito bold, icon before the label, 48px tall (44px for the small size).
 * On the forest hero card the primary button turns amber and the secondary one outlined.
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
  const { colors, isDark } = useTheme();
  const onBanner = useOnBanner();
  const isDisabled = disabled || loading;

  const bg: Record<Kind, string> = {
    primary: onBanner ? AMBER : isDark ? FOREST : colors.primary,
    secondary: onBanner ? 'transparent' : colors.card,
    danger: colors.red,
    ghost: 'transparent',
  };
  const fg: Record<Kind, string> = {
    primary: onBanner ? '#111611' : '#fff',
    secondary: onBanner ? '#fff' : colors.text,
    danger: '#fff',
    ghost: onBanner ? '#fff' : colors.primary,
  };
  const border: Record<Kind, string> = {
    primary: onBanner ? AMBER : isDark ? FOREST : colors.primary,
    secondary: onBanner ? 'rgba(255,255,255,0.45)' : colors.border,
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
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: border[kind],
          backgroundColor: bg[kind],
          minHeight: sm ? 44 : 48,
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
      <Text style={{ color: fg[kind], fontFamily: ff('700'), fontSize: sm ? 13 : 14 }}>{t(title)}</Text>
    </PressableScale>
  );
}
