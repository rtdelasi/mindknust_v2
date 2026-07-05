import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps as NavigatorBottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft, FadeOutRight, Layout } from 'react-native-reanimated';

import {
  BorderRadius,
  FontSize,
  FontWeight,
  Shadows,
  Size,
  Spacing,
} from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

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

export function BottomTabBar(props: BottomTabBarProps) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;

  const items =
    'state' in props
      ? props.state.routes
          .filter((route) => {
            const { options } = props.descriptors[route.key];
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
              size: 22,
            });

            return {
              key: route.key,
              label,
              iconNode: icon ?? null,
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
            } satisfies RenderedBottomTabItem;
          }) as RenderedBottomTabItem[]
      : props.items;

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
          borderRadius: BorderRadius.lg,
          height: Size.tabBarHeight,
          ...shadow.raised,
        },
      ]}>
      {items.map((item) => {
        const active = Boolean(item.active);
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.item,
              pressed && styles.pressed,
            ]}>
            <Animated.View
              layout={Layout.springify().damping(28).mass(0.8).stiffness(160)}
              style={styles.itemInner}>
              {active ? (
                <Animated.View
                  layout={Layout.springify().damping(28).mass(0.8).stiffness(160)}
                  style={[styles.activePill, { backgroundColor: theme.primary }]}>
                  <View style={styles.badge}>
                    {item.iconNode ?? (item.icon ? (
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={22}
                        color={theme.primary}
                      />
                    ) : null)}
                  </View>
                  <Animated.Text
                    entering={FadeInLeft.delay(50).duration(200)}
                    exiting={FadeOutRight.duration(150)}
                    style={[
                      styles.activeLabel,
                      {
                        color: '#FFFFFF',
                        fontSize: FontSize.caption + 1,
                        fontWeight: FontWeight.semibold,
                      },
                    ]}>
                    {item.label}
                  </Animated.Text>
                </Animated.View>
              ) : (
                <Animated.View
                  layout={Layout.springify().damping(28).mass(0.8).stiffness(160)}
                  style={styles.inactiveIconWrap}>
                  {item.iconNode ?? (item.icon ? (
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={22}
                      color={theme.textSecondary}
                    />
                  ) : null)}
                </Animated.View>
              )}
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  inactiveIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLabel: {
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.84,
  },
});
