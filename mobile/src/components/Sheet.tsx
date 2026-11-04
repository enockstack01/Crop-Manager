import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/theme';
import { AppText, IconButton, useLayout } from './ui';
import { t } from '../i18n';

/**
 * Phones: a bottom sheet. It slides up from the bottom edge, has a drag handle and rounded top
 * corners, closes when you swipe it down, tap outside it or press the Android back button, and keeps
 * its actions above the keyboard and the gesture bar.
 * Tablets: the same content in a centered dialog (max 420 or 600 wide).
 * Used for forms, menus, pickers and confirmations throughout the app.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scroll = true,
  size = 'md',
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  /** dialog width on tablets: 420 (sm) or 600 (md) */
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useLayout();
  const { height: windowHeight } = useWindowDimensions();

  // keep the modal mounted until the slide out animation has finished
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const drag = useRef(new Animated.Value(0)).current; // finger offset while swiping down
  const closing = useRef(false);

  useEffect(() => {
    if (visible) {
      closing.current = false;
      drag.setValue(0);
      setMounted(true);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 3 }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  // swipe down on the handle or the title to close
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 0.9) {
          Animated.timing(drag, { toValue: windowHeight, duration: 160, useNativeDriver: true }).start(dismiss);
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

  if (!mounted) return null;

  const header = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 20, paddingRight: 8, paddingVertical: 4, minHeight: 56,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
      }}
    >
      <AppText weight="700" accessibilityRole="header" style={{ fontSize: 18, flex: 1 }} numberOfLines={1}>{t(title)}</AppText>
      <IconButton name="close" size={16} onPress={dismiss} label="Close" />
    </View>
  );

  const body = scroll ? (
    <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled" bounces={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ padding: 20, gap: 16 }}>{children}</View>
  );

  const footerView = footer ? (
    <View
      style={{
        flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: isTablet ? 16 : 12 + insets.bottom,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      }}
    >
      {footer}
    </View>
  ) : null;

  /* ------------------------------------------------------------- tablet dialog */
  if (isTablet) {
    return (
      <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Animated.View
            style={{
              flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', opacity: progress,
              paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.md,
            }}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close dialog" />
            <Animated.View
              style={{
                width: '100%', maxWidth: size === 'sm' ? 420 : 600, maxHeight: '100%', backgroundColor: colors.card,
                borderRadius: radius.xl, overflow: 'hidden', ...shadow(3),
                transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
              }}
            >
              {header}
              {body}
              {footerView}
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  /* -------------------------------------------------------------- phone sheet */
  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] }),
    drag,
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={{
            backgroundColor: colors.card, maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
            paddingBottom: footer ? 0 : insets.bottom, transform: [{ translateY }],
          }}
        >
          <View {...pan.panHandlers}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            {header}
          </View>
          {body}
          {footerView}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
