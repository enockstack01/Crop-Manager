import React from 'react';
import { ActivityIndicator, Pressable, Text, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';

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
  const pad = size === 'sm' ? { paddingVertical: spacing.sm, paddingHorizontal: spacing.md } : { paddingVertical: spacing.md, paddingHorizontal: spacing.lg };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
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
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        pad,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[kind]} />
      ) : icon ? (
        <MaterialCommunityIcons name={icon as any} size={size === 'sm' ? 15 : 18} color={fg[kind]} />
      ) : null}
      <Text style={{ color: fg[kind], fontWeight: '700', fontSize: size === 'sm' ? 13 : 14 }}>{title}</Text>
    </Pressable>
  );
}
