import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps as NavigatorBottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useMockAuth } from '@/lib/mock-auth-store';

export type BottomTabItem = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconNode?: ReactNode;
  active?: boolean;
  onPress?: () => void;
};

type RenderedBottomTabItem = Omit<BottomTabItem, 'icon'> & {
  icon?: BottomTabItem['icon'];
};

type ManualBottomTabBarProps = {
  items: BottomTabItem[];
};

type BottomTabBarProps =
  | ManualBottomTabBarProps
  | NavigatorBottomTabBarProps;

function TabItem({ item, theme }: { item: RenderedBottomTabItem & { badgeNode?: ReactNode }; theme: any }) {
  const active = Boolean(item.active);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        key={item.key}
        onPress={item.onPress}
        onPressIn={() => {
          scale.value = withSpring(0.85, Timing.springSnappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, Timing.spring);
        }}
        style={styles.item}>
        <View style={styles.itemInner}>
          <View style={styles.iconContainer}>
            {item.iconNode ?? (item.icon ? (
              <MaterialCommunityIcons
                name={item.icon}
                size={24}
                color={active ? theme.primary : theme.textSecondary}
              />
            ) : null)}
            {item.badgeNode}
          </View>
          {active && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
          <Text
            style={[
              styles.label,
              {
                color: active ? theme.primary : theme.textSecondary,
                fontWeight: active ? FontWeight.bold : FontWeight.medium,
              },
            ]}>
            {item.label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function BottomTabBar(props: BottomTabBarProps) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;
  const { role } = useMockAuth();

  const items =
    'state' in props
      ? props.state.routes
        .filter((route) => {
          const { options } = props.descriptors[route.key];
          if (route.name === 'approvals' && role !== 'admin') {
            return false;
          }
          return (options as any).href !== null && route.name !== 'search';
        })
        .map((route) => {
          const { options } = props.descriptors[route.key];
          const activeRouteName = props.state.routes[props.state.index].name;
          const isActive = route.name === activeRouteName;

          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;

          const icon = options.tabBarIcon?.({
            focused: isActive,
            color: isActive ? theme.primary : theme.textSecondary,
            size: 24,
          });

          const badge = options.tabBarBadge;

          return {
            key: route.key,
            label,
            iconNode: icon ?? null,
            badgeNode:
              badge !== undefined &&
              badge !== null &&
              (typeof badge === 'string' || (typeof badge === 'number' && badge > 0)) ? (
                <View style={[styles.badgeContainer, { backgroundColor: theme.error }]}>
                  <Text style={styles.badgeText}>
                    {typeof badge === 'number' && badge > 9 ? '9+' : String(badge)}
                  </Text>
                </View>
              ) : null,
            active: isActive,
            onPress: () => {
              const event = props.navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!event.defaultPrevented) {
                props.navigation.navigate(route.name);
              }
            },
          } satisfies RenderedBottomTabItem & { badgeNode?: ReactNode };
        }) as (RenderedBottomTabItem & { badgeNode?: ReactNode })[]
      : props.items;

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: theme.surfaceRaised,
          height: Size.tabBarHeight,
          ...shadow.raised,
        },
      ]}>
      {items.map((item) => (
        <TabItem key={item.key} item={item} theme={theme} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.two,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    position: 'relative',
  },
  activeIndicator: {
    width: 20,
    height: 3,
    borderRadius: BorderRadius.full,
  },
  label: {
    fontSize: FontSize.small,
    letterSpacing: 0.1,
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
});
