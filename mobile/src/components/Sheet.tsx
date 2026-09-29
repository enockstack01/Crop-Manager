import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/theme';
import { AppText, IconButton } from './ui';

/**
 * Centered dialog matching the web app's <Modal> (modals.css): white card, 16/600
 * title with a close button over a divider, padded scrollable body, footer with
 * right-aligned actions. Max 600px wide like the web's .modal, so it also sits
 * nicely on tablets. Used for create/edit forms, record details, pickers, confirms.
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
  /** web .modal-sm (420) / .modal (600) */
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
    }
  }, [visible, anim]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          style={{
            flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center',
            paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.md,
          }}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" />
          <Animated.View
            style={{
              width: '100%',
              maxWidth: size === 'sm' ? 420 : 600,
              maxHeight: '100%',
              backgroundColor: colors.card,
              borderRadius: radius.lg + 2,
              overflow: 'hidden',
              ...shadow(3),
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
            }}
          >
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingLeft: 24, paddingRight: 14, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: colors.border,
              }}
            >
              <AppText weight="600" style={{ fontSize: 16, flex: 1 }} numberOfLines={1}>{title}</AppText>
              <IconButton name="close" size={15} onPress={onClose} label="Close" />
            </View>

            {scroll ? (
              <ScrollView
                style={{ flexGrow: 0, flexShrink: 1 }}
                contentContainerStyle={{ padding: 24, gap: 18 }}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={{ padding: 24, gap: 18 }}>{children}</View>
            )}

            {footer ? (
              <View
                style={{
                  flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10,
                  paddingHorizontal: 24, paddingVertical: 16,
                  borderTopWidth: 1, borderTopColor: colors.border,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
