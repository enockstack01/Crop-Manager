import React, { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shadow, spacing } from '../../theme/theme';
import { AppText } from '../../components/ui';
import { LeafLogo } from '../../components/LeafLogo';
import { haptics } from '../../lib/haptics';

/**
 * Shared frame for the auth screens: brand gradient header with the leaf mark,
 * and the form on a rounded sheet that slides up on mount. Scrolls and avoids the
 * keyboard so fields are never hidden on small phones.
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [enter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
          <LinearGradient
            colors={isDark ? ['#1B5E20', '#0F2E12'] : ['#43A047', '#1B5E20']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingTop: insets.top + spacing.xxl, paddingBottom: 56, alignItems: 'center' }}
          >
            {/* soft decorative circles, echoing the web sign-in panel */}
            <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -70 }} />
            <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: -40 }} />
            <View
              style={{
                width: 84, height: 84, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
              }}
            >
              <LeafLogo size={64} scale={1.15} />
            </View>
            <AppText style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 0.3 }}>CropManager</AppText>
            <AppText style={{ color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.xl }}>
              Plan, track and grow — your whole farm in one place
            </AppText>
          </LinearGradient>

          <Animated.View
            style={{
              flex: 1,
              marginTop: -32,
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl + 4,
              borderTopRightRadius: radius.xl + 4,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              ...shadow(2),
            }}
          >
            <AppText variant="title" style={{ fontSize: 24 }}>{title}</AppText>
            <AppText variant="subtitle" style={{ marginTop: 4, marginBottom: spacing.xl }}>{subtitle}</AppText>
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Tappable inline text action ("Forgot password?", "Use an email code instead"). */
export function TextLink({ title, onPress, muted, disabled }: { title: string; onPress: () => void; muted?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <AppText weight={muted ? '600' : '700'} color={muted ? colors.textLight : colors.primary}>
        {title}
      </AppText>
    </Pressable>
  );
}

/** "──── or ────" separator between social and email sign-in. */
export function OrDivider() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <AppText variant="caption" weight="600">or continue with email</AppText>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

/** Inline error banner used by the auth forms. */
export function AuthError({ message }: { message: string }) {
  const { isDark } = useTheme();
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: isDark ? '#3D1A1A' : '#FFEBEE', borderRadius: radius.md, padding: spacing.md,
        borderLeftWidth: 3, borderLeftColor: '#D32F2F',
      }}
    >
      <AppText style={{ color: isDark ? '#FFCDD2' : '#C62828' }}>{message}</AppText>
    </View>
  );
}
