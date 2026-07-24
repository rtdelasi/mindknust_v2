import { Colors } from '@/constants/theme';
import { useThemeMode as useThemeModeFromContext } from '@/contexts/theme-context';

export type ThemeMode = keyof typeof Colors;

export function useThemeMode(): ThemeMode {
  return useThemeModeFromContext();
}

export function useTheme(): (typeof Colors)[ThemeMode] {
  const mode = useThemeMode();
  return Colors[mode];
}
