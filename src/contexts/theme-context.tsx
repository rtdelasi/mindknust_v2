import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

import { Colors, ThemeColor } from '@/constants/theme';
import { safeStorage } from '@/lib/safe-storage';

const THEME_KEY = 'counselcare_theme_mode';

type ThemeMode = ThemeColor;

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  // Hydrate from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await safeStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') {
          setModeState(stored);
        }
      } catch {
        // Ignore read errors, default to light
      }
    })();
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    safeStorage.setItem(THEME_KEY, newMode).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : 'light');
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemeMode(): ThemeMode {
  const { mode } = useContext(ThemeContext);
  return mode;
}

export function getThemeColors(mode: ThemeMode) {
  return Colors[mode];
}
