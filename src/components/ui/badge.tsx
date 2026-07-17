import { ReactNode, useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

export interface BadgeProps {
  /** The icon or component to be badged. If omitted, Badge renders as a standalone indicator. */
  children?: ReactNode;
  /** The count of items to show. If count is 0, the badge is hidden completely. */
  count?: number;
  /** The maximum value to display. If count is larger, renders as `{max}+`. Default is 99. */
  max?: number;
  /** If true, renders a small dot badge indicator without any text count. Default is false. */
  dot?: boolean;
  /** Custom background color for the badge. Default is a classic red '#EF4444'. */
  color?: string;
  /** Height and min-width of the badge when displaying text. Default is 18. */
  size?: number;
  /** Enables/disables scale pop-in and value pulse animations. Default is true. */
  animate?: boolean;
  /** Style for the badge component itself. */
  style?: StyleProp<ViewStyle>;
  /** Style for the text indicator. */
  textStyle?: StyleProp<TextStyle>;
  /** Style for the wrapping container (only active when children are present). */
  containerStyle?: StyleProp<ViewStyle>;
}

export function Badge({
  children,
  count = 0,
  max = 99,
  dot = false,
  color = '#EF4444',
  size = 18,
  animate = true,
  style,
  textStyle,
  containerStyle,
}: BadgeProps) {
  // Visibility: Hide completely if count is 0. Show if count > 0 or in dot mode with undefined count.
  const isVisible = count > 0 || (dot && count === undefined);

  // Formatted count display value
  const displayValue = count > max ? `${max}+` : count.toString();

  // Accessibility screen-reader description
  const accessibilityLabel = dot
    ? 'New notification'
    : `${count > max ? `More than ${max}` : count} unread notification${count === 1 ? '' : 's'}`;

  // Animation values
  const scale = useSharedValue(isVisible ? 1 : 0);
  const prevCount = useRef(count);
  const prevIsVisible = useRef(isVisible);

  useEffect(() => {
    if (!animate) {
      scale.value = isVisible ? 1 : 0;
      return;
    }

    if (isVisible) {
      if (!prevIsVisible.current) {
        // Pop-in scale animation when transitioning from invisible to visible
        scale.value = 0.2;
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      } else if (prevCount.current !== count) {
        // Subtle pulse/pop-up animation when the active value changes
        scale.value = withSequence(
          withSpring(1.3, { damping: 8, stiffness: 300 }),
          withSpring(1.0, { damping: 12, stiffness: 200 })
        );
      }
    } else {
      // Scale down when turning off
      scale.value = withSpring(0, { damping: 15, stiffness: 250 });
    }

    prevCount.current = count;
    prevIsVisible.current = isVisible;
  }, [count, isVisible, animate]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: scale.value,
    };
  });

  // If not visible and animations are disabled or scale has reached 0, skip rendering the badge element
  if (!isVisible && (!animate || scale.value === 0)) {
    return children ? <View style={[styles.container, containerStyle]}>{children}</View> : null;
  }

  // Calculate layout sizes
  const badgeSize = dot ? Math.round(size * 0.5) : size;
  const isPill = !dot && displayValue.length > 1;

  // Slight negative offset based on size for clean overlay positioning
  const offset = -badgeSize / 3.5;

  const badgeStyles: StyleProp<ViewStyle> = [
    styles.badge,
    {
      backgroundColor: color,
      height: badgeSize,
      minWidth: badgeSize,
      borderRadius: badgeSize / 2,
    },
    children ? {
      position: 'absolute',
      top: offset,
      right: offset,
    } : null,
    isPill ? {
      paddingHorizontal: Math.round(size * 0.28),
    } : null,
    style,
  ];

  const textStyles = [
    styles.text,
    {
      fontSize: Math.round(size * 0.61),
      lineHeight: Math.round(size * 0.72),
    },
    textStyle,
  ];

  const badgeContent = (
    <Animated.View
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      style={[badgeStyles, animate && animatedStyle]}
    >
      {!dot && (
        <Text numberOfLines={1} style={textStyles}>
          {displayValue}
        </Text>
      )}
    </Animated.View>
  );

  if (children) {
    return (
      <View style={[styles.container, containerStyle]}>
        {children}
        {badgeContent}
      </View>
    );
  }

  return badgeContent;
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    position: 'relative',
    overflow: 'visible',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});
