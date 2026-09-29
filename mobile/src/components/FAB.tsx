import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { shadow } from '../theme/theme';
import { PressableScale } from './PressableScale';

export function FAB({ onPress, icon = 'plus', label = 'Add' }: { onPress: () => void; icon?: string; label?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;

  // pop in when the screen mounts
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, delay: 150, bounciness: 10 }).start();
  }, [enter]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: 20,
        bottom: 20 + insets.bottom,
        transform: [{ scale: enter }],
      }}
    >
      <PressableScale
        onPress={onPress}
        feedback="press"
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          width: 58,
          height: 58,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow(3),
        }}
      >
        <Icon name={icon as any} size={28} color="#fff" />
      </PressableScale>
    </Animated.View>
  );
}
