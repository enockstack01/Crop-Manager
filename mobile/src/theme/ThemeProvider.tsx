import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light, Palette } from './theme';

type Mode = 'light' | 'dark' | 'system';

type ThemeCtx = {
  colors: Palette;
  isDark: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
};

const Ctx = createContext<ThemeCtx>({
  colors: light,
  isDark: false,
  mode: 'system',
  setMode: () => {},
});

const KEY = 'cropmanager.themeMode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';

  const value = useMemo<ThemeCtx>(
    () => ({ colors: isDark ? dark : light, isDark, mode, setMode }),
    [isDark, mode, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
