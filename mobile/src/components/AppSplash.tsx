import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LeafLogo } from './LeafLogo';

// keep the native splash up until the animated one has drawn its first frame
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Longest the splash waits for the app before stepping aside anyway. */
const MAX_WAIT = 8000;
/** Shortest it stays, so the intro animation can finish instead of flashing. */
const MIN_SHOW = 1100;

const SplashReadyCtx = createContext<() => void>(() => {});
/** Screens call this once they know what to show (auth, onboarding, dashboard, error). */
export const useSplashReady = () => useContext(SplashReadyCtx);

/** Signals the splash once on mount — for screens that are ready as soon as they render. */
export function SplashReadyOnMount() {
  const ready = useSplashReady();
  useEffect(() => ready(), [ready]);
  return null;
}

/**
 * Animated continuation of the native splash: same background and leaf position,
 * so the hand-off is seamless. The leaf lifts, the wordmark fades in, a progress
 * bar runs while the app loads, then the whole layer fades away.
 */
export function SplashHost({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const shownAt = useRef(Date.now());

  const intro = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 700, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ).start();
    const cap = setTimeout(markReady, MAX_WAIT);
    return () => clearTimeout(cap);
  }, [intro, progress, markReady]);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_SHOW - (Date.now() - shownAt.current));
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setGone(true));
    }, wait);
    return () => clearTimeout(t);
  }, [ready, fade]);

  const leafY = intro.interpolate({ inputRange: [0, 1], outputRange: [0, -36] });
  const leafScale = intro.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
  const textY = intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <SplashReadyCtx.Provider value={markReady}>
      <View style={{ flex: 1 }}>
        {children}
        {gone ? null : (
          <Animated.View
            pointerEvents={ready ? 'none' : 'auto'}
            onLayout={() => SplashScreen.hideAsync().catch(() => {})}
            style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: dark ? '#0F1A10' : '#2E7D32', alignItems: 'center', justifyContent: 'center' }]}
          >
            {/* same size/position as the native splash image (imageWidth 180) */}
            <Animated.View style={{ transform: [{ translateY: leafY }, { scale: leafScale }] }}>
              <LeafLogo size={180} scale={0.9} color={dark ? '#66BB6A' : '#FFFFFF'} />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', top: '58%', alignItems: 'center', opacity: intro, transform: [{ translateY: textY }] }}>
              <Animated.Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: 0.5 }}>CropManager</Animated.Text>
              <Animated.Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, marginTop: 6 }}>
                Crop production, managed
              </Animated.Text>
              <View style={{ width: 120, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 28, overflow: 'hidden' }}>
                <Animated.View
                  style={{
                    width: 48, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF',
                    transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-48, 120] }) }],
                  }}
                />
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </SplashReadyCtx.Provider>
  );
}
