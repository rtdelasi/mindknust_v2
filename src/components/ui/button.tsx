import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import {
  BorderRadius,
  FontSize,
  FontWeight,
  Shadows,
  Size,
  Spacing,
} from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary ? theme.primary : theme.surfaceRaised,
          borderColor: isPrimary ? theme.primary : theme.border,
          minHeight: Size.buttonHeight,
          borderRadius: BorderRadius.full,
          ...(!isPrimary ? shadow.card : shadow.raised),
          opacity: disabled ? 0.56 : pressed ? 0.84 : 1,
        },
        style,
      ]}>
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={Size.iconMd}
          color={isPrimary ? theme.surfaceRaised : theme.primary}
        />
      ) : null}
      <Text
        style={[
          styles.label,
          {
            color: isPrimary ? theme.surfaceRaised : theme.primary,
            fontSize: FontSize.body,
            fontWeight: FontWeight.bold,
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
  },
  label: {
    letterSpacing: 0.1,
  },
});
