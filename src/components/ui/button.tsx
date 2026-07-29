import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  BorderRadius,
  FontSize,
  FontWeight,
  Shadows,
  Size,
  Spacing,
  Timing,
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

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, Timing.springSnappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Timing.spring);
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: isPrimary ? theme.primary : theme.surfaceSoft,
            minHeight: Size.buttonHeight,
            borderRadius: BorderRadius.xl,
            ...(!isPrimary ? shadow.small : shadow.medium),
            opacity: disabled ? 0.56 : 1,
          },
        ]}>
        {icon ? (
          <MaterialCommunityIcons
            name={icon}
            size={Size.iconMd}
            color={isPrimary ? theme.textInverse : theme.primary}
          />
        ) : null}
        <Text
          style={[
            styles.label,
            {
              color: isPrimary ? theme.textInverse : theme.primary,
              fontSize: FontSize.body,
              fontWeight: FontWeight.semibold,
            },
          ]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  label: {
    letterSpacing: 0.1,
  },
});
