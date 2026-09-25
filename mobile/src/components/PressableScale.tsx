import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { haptics } from '../lib/haptics';

type Feedback = 'tap' | 'press' | 'select' | 'none';

/**
 * Pressable that springs down slightly while held and optionally fires a haptic
 * tick — the shared "this responded to my finger" affordance for buttons, cards
 * and rows.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  feedback = 'tap',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  scaleTo?: number;
  feedback?: Feedback;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressed = useRef(false);

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: to === 1 ? 6 : 0 }).start();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.current = true;
        animate(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.current = false;
        animate(1);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback !== 'none') haptics[feedback]();
        onPress?.(e);
      }}
    >
      {(state) => (
        <Animated.View
          style={[typeof style === 'function' ? style(state) : style, { transform: [{ scale }] }]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
