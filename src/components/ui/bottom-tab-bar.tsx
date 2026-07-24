import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps as NavigatorBottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
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
                <View style={styles.badgeContainer}>
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
          borderColor: theme.border,
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
    paddingHorizontal: Spacing.two,
    borderWidth: 0,
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    position: 'relative',
  },
  label: {
    fontSize: FontSize.small,
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.72,
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
});
