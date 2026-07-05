import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

type CardVariant = 'surface' | 'raised' | 'muted';

type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: keyof typeof Spacing;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'surface', padding = 'three', style }: CardProps) {
  const theme = useTheme();
  const mode = useThemeMode();
  const isDark = mode === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;
  const backgroundColor =
    variant === 'muted'
      ? theme.surfaceSoft
      : variant === 'raised'
        ? theme.surfaceRaised
        : theme.surface;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          padding: Spacing[padding],
          borderRadius: BorderRadius.lg,
          borderColor: theme.border,
          ...shadow[variant === 'raised' ? 'raised' : 'card'],
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
