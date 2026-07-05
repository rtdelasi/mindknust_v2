import { Colors } from '@/constants/theme';

export type ThemeMode = keyof typeof Colors;

export function useThemeMode(): ThemeMode {
  return 'light';
}

export function useTheme(): (typeof Colors)[ThemeMode] {
  const mode = useThemeMode();
  return Colors[mode];
}
