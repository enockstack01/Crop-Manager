import React, { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { ff, radius, shadow, spacing } from '../../theme/theme';
import { AppText, useLayout } from '../../components/ui';
import { LeafLogo } from '../../components/LeafLogo';
import { haptics } from '../../lib/haptics';

/**
 * The web app's sign-in page at phone width (client/src/components/AuthScreen.jsx):
 * white page, brand row (gradient leaf tile + "CropManager"), page heading and
 * subtitle, then a Clerk-style card with a centred title/subtitle holding the form,
 * and an optional line under the card ("Don't have an account? Sign up").
 */
export function AuthLayout({
  heading = 'Welcome',
  intro = 'Sign in to your farm management dashboard',
  title,
  subtitle,
  footer,
  children,
}: {
  /** page heading (web .auth-split-form-wrapper h2) */
  heading?: string;
  /** page subtitle under the heading */
  intro?: string;
  /** card title (Clerk card header) */
  title: string;
  /** card subtitle */
  subtitle: string;
  /** shown under the card */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useLayout();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [enter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1, justifyContent: 'center',
            paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32, paddingHorizontal: 20,
          }}
        >
          <Animated.View
            style={{
              width: '100%', maxWidth: 420, alignSelf: 'center',
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            {/* .auth-split-mobile-brand */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <LinearGradient
                colors={['#43A047', '#1B5E20']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow(2) }}
              >
                <LeafLogo size={30} scale={1.05} />
              </LinearGradient>
              <Text style={{ fontSize: 20, fontFamily: ff('800'), color: colors.text }}>CropManager</Text>
            </View>

            <AppText weight="700" style={{ fontSize: isTablet ? 28 : 26, lineHeight: 34 }}>{heading}</AppText>
            <AppText variant="subtitle" style={{ marginTop: 6, marginBottom: 30 }}>{intro}</AppText>

            {/* Clerk-style card */}
            <View
              style={{
                backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
                paddingHorizontal: 24, paddingVertical: 28, ...shadow(3),
              }}
            >
              <AppText weight="700" style={{ fontSize: 17, textAlign: 'center' }}>{title}</AppText>
              <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 24 }}>{subtitle}</AppText>
              {children}
            </View>

            {footer ? <View style={{ marginTop: 20, alignItems: 'center' }}>{footer}</View> : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Tappable inline text action ("Forgot password?", "Use an email code instead"). */
export function TextLink({ title, onPress, muted, disabled, size = 13 }: { title: string; onPress: () => void; muted?: boolean; disabled?: boolean; size?: number }) {
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
      <AppText weight={muted ? '500' : '600'} style={{ fontSize: size }} color={muted ? colors.textLight : colors.primary}>
        {title}
      </AppText>
    </Pressable>
  );
}

/** Line under the card: "Don't have an account? Sign up" (web .auth-split-switch). */
export function AuthSwitch({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <AppText variant="subtitle" style={{ fontSize: 14 }}>{prompt}</AppText>
      <TextLink title={action} onPress={onPress} size={14} />
    </View>
  );
}

/** Clerk's "──── or ────" separator between social and email sign-in. */
export function OrDivider() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <AppText style={{ fontSize: 13, color: colors.textLight }}>or</AppText>
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
      <AppText style={{ fontSize: 13, color: isDark ? '#FFCDD2' : '#C62828' }}>{message}</AppText>
    </View>
  );
}
