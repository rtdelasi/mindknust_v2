import '@/global.css';

import { Platform } from 'react-native';

// ─── PURPLE / INDIGO TONAL SCALE ────────────────────────────────────────
// Brand anchor: #6C63FF at the 500 step.
// Lighter steps for tints/fills, darker steps for text-on-color + pressed states.
export const PurpleScale = {
  50:  '#F5F3FF',
  100: '#EDE9FE',
  200: '#DDD6FE',
  300: '#C4B5FD',
  400: '#8B7CFF',
  500: '#6C63FF',
  600: '#5B4FE5',
  700: '#4C3DD6',
  800: '#3B2FAD',
  900: '#2C2280',
} as const;

// ─── NEUTRAL SCALE ──────────────────────────────────────────────────────
// Warm-gray leaning (slight blue undertone) to complement the purple.
export const NeutralScale = {
  50:  '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
} as const;

// ─── ACCENT PALETTE ─────────────────────────────────────────────────────
// Coral / Amber  — warmth, alerts, active streaks
// Teal / Mint    — calm, wellness, nature
// Rose           — anonymity / privacy features
export const AccentColors = {
  coral:        '#FF6B6B',
  coralLight:   '#FFE8E8',
  coralDark:    '#D94848',
  amber:        '#F59E0B',
  amberLight:   '#FEF3C7',
  amberDark:    '#B45309',
  teal:         '#14B8A6',
  tealLight:    '#CCFBF1',
  tealDark:     '#0D9488',
  rose:         '#E879A0',
  roseLight:    '#FFF0F6',
  roseDark:     '#BE185D',
} as const;

// ─── LIGHT THEME ────────────────────────────────────────────────────────
export const LightColors = {
  // --- text ---
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // --- surfaces (cool-tinted neutrals, not pure white) ---
  background: '#F8F7FC',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSoft: '#F3F1FA',
  surfaceMuted: '#EEEAF5',
  surfaceSunken: '#F0EFF4',

  // --- brand ---
  primary: PurpleScale[600],
  primarySoft: PurpleScale[100],
  primaryMuted: PurpleScale[50],
  accent: PurpleScale[500],
  accentSoft: PurpleScale[100],
  onPrimary: '#FFFFFF',

  // --- accent colors ---
  coral: AccentColors.coral,
  coralSoft: AccentColors.coralLight,
  amber: AccentColors.amber,
  amberSoft: AccentColors.amberLight,
  teal: AccentColors.teal,
  tealSoft: AccentColors.tealLight,
  rose: AccentColors.rose,
  roseSoft: AccentColors.roseLight,

  // --- semantic ---
  success: '#10B981',
  successSoft: '#D1FAE5',
  warning: AccentColors.amber,
  warningSoft: AccentColors.amberLight,
  error: AccentColors.coral,
  errorSoft: AccentColors.coralLight,
  info: AccentColors.teal,
  infoSoft: AccentColors.tealLight,

  // --- borders & dividers ---
  border: 'rgba(15, 23, 42, 0.07)',
  borderStrong: 'rgba(15, 23, 42, 0.14)',
  divider: 'rgba(15, 23, 42, 0.05)',

  // --- overlay & shadow ---
  overlay: 'rgba(15, 23, 42, 0.55)',
  shadow: 'rgba(15, 23, 42, 0.10)',

  // --- special ---
  skeleton: '#E8E6F0',
  skeletonHighlight: '#F5F3FA',
} as const;

// ─── DARK THEME ─────────────────────────────────────────────────────────
export const DarkColors = {
  // --- text ---
  text: '#F1F0F5',
  textSecondary: '#A09CB5',
  textTertiary: '#6E6A88',
  textInverse: '#1A1A1A',

  // --- surfaces (deep navy, not pure black) ---
  background: '#0C0E14',
  surface: '#131620',
  surfaceRaised: '#1A1E2C',
  surfaceSoft: '#1F2333',
  surfaceMuted: '#242840',
  surfaceSunken: '#0A0C11',

  // --- brand ---
  primary: PurpleScale[400],
  primarySoft: 'rgba(139, 124, 255, 0.15)',
  primaryMuted: 'rgba(139, 124, 255, 0.08)',
  accent: PurpleScale[500],
  accentSoft: 'rgba(108, 99, 255, 0.12)',
  onPrimary: '#FFFFFF',

  // --- accent colors (slightly desaturated for dark mode) ---
  coral: '#FF8A8A',
  coralSoft: 'rgba(255, 107, 107, 0.15)',
  amber: '#FBBF24',
  amberSoft: 'rgba(245, 158, 11, 0.15)',
  teal: '#2DD4BF',
  tealSoft: 'rgba(20, 184, 166, 0.15)',
  rose: '#F0A0C0',
  roseSoft: 'rgba(232, 121, 160, 0.15)',

  // --- semantic ---
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.15)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.15)',
  error: '#FF8A8A',
  errorSoft: 'rgba(255, 107, 107, 0.15)',
  info: '#2DD4BF',
  infoSoft: 'rgba(45, 212, 191, 0.15)',

  // --- borders & dividers ---
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',
  divider: 'rgba(255, 255, 255, 0.05)',

  // --- overlay & shadow ---
  overlay: 'rgba(0, 0, 0, 0.65)',
  shadow: 'rgba(0, 0, 0, 0.50)',

  // --- special ---
  skeleton: '#1F2333',
  skeletonHighlight: '#282D3E',
} as const;

export const Colors = {
  light: LightColors,
  dark: DarkColors,
} as const;

export type ThemeColor = keyof typeof LightColors & keyof typeof DarkColors;

// ─── BORDER RADIUS ──────────────────────────────────────────────────────
// Shape language: softer for friendly elements, tighter for compact ones.
export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

// ─── FONT SIZE ──────────────────────────────────────────────────────────
// 8-step type scale with intermediate sizes to kill the "arithmetic" pattern.
export const FontSize = {
  display: 32,
  h1: 28,
  h2: 22,
  h3: 18,
  bodyLg: 17,
  body: 16,
  bodySm: 15,
  captionLg: 14,
  caption: 13,
  small: 11,
  micro: 10,
} as const;

export const FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

// ─── SIZE ───────────────────────────────────────────────────────────────
export const Size = {
  iconXs: 12,
  iconSm: 14,
  iconMd: 18,
  iconLg: 22,
  iconXl: 26,
  iconXxl: 32,
  buttonHeight: 48,
  buttonHeightSm: 40,
  inputHeight: 56,
  avatarXs: 28,
  avatarSm: 40,
  avatarMd: 56,
  avatarLg: 72,
  avatarXl: 96,
  tabBarHeight: 84,
  // Height of the floating tab pill itself, excluding the gap it leaves to the
  // screen edges. Shorter than tabBarHeight because the safe-area inset sits
  // outside the pill rather than inside it.
  tabBarPillHeight: 64,
  minTouchTarget: 44,
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

// ─── SPACING ────────────────────────────────────────────────────────────
// 4px base grid. Intermediate tokens added to eliminate arithmetic.
export const Spacing = {
  half: 2,
  one: 4,
  oneHalf: 6,
  two: 8,
  twoHalf: 12,
  three: 16,
  threeHalf: 20,
  four: 24,
  five: 32,
  six: 40,
  seven: 48,
  eight: 64,
} as const;

// ─── ELEVATION / SHADOWS ────────────────────────────────────────────────
// 4-tier elevation system: flat → subtle → raised → floating.
// Each tier has light and dark variants.
export const Shadows = {
  light: {
    flat: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    small: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    card: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    medium: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    raised: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.10,
      shadowRadius: 20,
      elevation: 4,
    },
    floating: {
      shadowColor: LightColors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 28,
      elevation: 6,
    },
  },
  dark: {
    flat: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    small: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 1,
    },
    card: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.20,
      shadowRadius: 14,
      elevation: 2,
    },
    medium: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 20,
      elevation: 3,
    },
    raised: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 26,
      elevation: 5,
    },
    floating: {
      shadowColor: DarkColors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.40,
      shadowRadius: 32,
      elevation: 7,
    },
  },
} as const;

// ─── LINE HEIGHTS (new — for consistent typography rhythm) ──────────────
export const LineHeight = {
  tight: 1.2,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.65,
  loose: 1.8,
} as const;

// ─── LETTER SPACING ─────────────────────────────────────────────────────
export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.3,
  wider: 0.6,
  widest: 1.2,
} as const;

// ─── TIMING / ANIMATION ─────────────────────────────────────────────────
// Standard durations and easings for Reanimated/shared transitions.
export const Timing = {
  instant: 80,
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  } as const,
  springGentle: {
    damping: 18,
    stiffness: 120,
    mass: 1,
  } as const,
  springSnappy: {
    damping: 20,
    stiffness: 200,
    mass: 0.8,
  } as const,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
