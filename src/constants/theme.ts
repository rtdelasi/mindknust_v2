import '@/global.css';

import { Platform } from 'react-native';

export const LightColors = {
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSoft: '#F3F4F6',
  surfaceMuted: '#EEF2F7',
  border: 'rgba(17, 24, 39, 0.08)',
  primary: '#5B4FE5',
  primarySoft: '#EAE8FF',
  accent: '#6C63FF',
  accentSoft: '#ECEBFF',
  onPrimary: '#FFFFFF',
  success: '#3F8C7A',
  warning: '#D9A441',
  shadow: 'rgba(15, 23, 42, 0.10)',
} as const;

export const DarkColors = {
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  background: '#0B0F14',
  surface: '#111722',
  surfaceRaised: '#16202D',
  surfaceSoft: '#1A2432',
  surfaceMuted: '#1E2B3A',
  border: 'rgba(255, 255, 255, 0.12)',
  primary: '#8B7CFF',
  primarySoft: '#22214A',
  accent: '#7C6CFF',
  accentSoft: '#1E1B40',
  onPrimary: '#FFFFFF',
  success: '#5EE0B0',
  warning: '#F3C86B',
  shadow: 'rgba(0, 0, 0, 0.50)',
} as const;

export const Colors = {
  light: LightColors,
  dark: DarkColors,
} as const;

export type ThemeColor = keyof typeof LightColors & keyof typeof DarkColors;

export const BorderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  full: 999,
} as const;

export const FontSize = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  caption: 13,
  small: 11,
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const Size = {
  iconSm: 14,
  iconMd: 18,
  iconLg: 22,
  iconXl: 26,
  buttonHeight: 48,
  inputHeight: 56,
  avatarSm: 40,
  avatarMd: 56,
  avatarLg: 72,
  tabBarHeight: 84,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Shadows = {
  light: {
    card: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 2,
    },
    raised: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 4,
    },
    floating: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 6,
    },
  },
  dark: {
    card: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.30,
      shadowRadius: 20,
      elevation: 4,
    },
    raised: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.36,
      shadowRadius: 28,
      elevation: 5,
    },
    floating: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.42,
      shadowRadius: 34,
      elevation: 7,
    },
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
