import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps as NavigatorTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BorderRadius,
  FontSize,
  FontWeight,
  NeutralScale,
  PurpleScale,
  Size,
  Spacing,
  Timing,
} from '@/constants/theme';
import { useThemeMode } from '@/hooks/use-theme';
import { useMockAuth } from '@/lib/mock-auth-store';

// Brand anchor (PurpleScale 500). Kept as a token rather than a literal so the
// bar tracks the palette if the anchor ever moves.
const ACTIVE_COLOR = PurpleScale[500];
const ACTIVE_PILL_COLOR = `${PurpleScale[500]}1A`;
const INACTIVE_COLOR = NeutralScale[400];

const BAR_HEIGHT = Size.tabBarPillHeight;
const BAR_RADIUS = 28;
const EDGE_MARGIN = Spacing.three; // 16
const PILL_GAP = Spacing.one; // horizontal breathing room around the pill
const PILL_INSET = Spacing.oneHalf; // vertical inset of the pill within the bar

/**
 * Vertical space the floating bar occupies, measured from the bottom of the
 * screen: the bar itself plus the gap it leaves below.
 *
 * Anything that floats over a tab screen (FABs, snackbars, sheets) must clear
 * this. It cannot be solved with zIndex — the navigator renders the tab bar as
 * a later sibling of the screen container, so the bar always paints above
 * screen content no matter what a child of that content asks for.
 *
 * Pass the safe-area inset in; the bar uses the same max() the shell does.
 */
export function floatingTabBarSpace(bottomInset: number) {
  return Math.max(bottomInset, EDGE_MARGIN) + BAR_HEIGHT;
}

/** Comfortable resting offset for a FAB sitting above the floating bar. */
export function floatingTabBarClearance(bottomInset: number) {
  return floatingTabBarSpace(bottomInset) + EDGE_MARGIN;
}

export type FloatingTabItem = {
  key: string;
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconNode?: ReactNode;
  badgeNode?: ReactNode;
  active?: boolean;
  onPress?: () => void;
};

type ManualProps = { tabs: FloatingTabItem[] };

type FloatingTabBarProps = ManualProps | NavigatorTabBarProps;

function TabButton({
  item,
  width,
}: {
  item: FloatingTabItem;
  width: number;
}) {
  const active = Boolean(item.active);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;

  return (
    <Animated.View style={[{ width: width || undefined }, width ? null : styles.flexItem, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        onPress={item.onPress}
        onPressIn={() => {
          scale.value = withSpring(0.9, Timing.springSnappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, Timing.spring);
        }}
        style={styles.pressable}>
        <View style={styles.iconContainer}>
          {item.iconNode ??
            (item.icon ? (
              <MaterialCommunityIcons name={item.icon} size={23} color={color} />
            ) : null)}
          {item.badgeNode}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color, fontWeight: active ? FontWeight.bold : FontWeight.medium },
          ]}>
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function FloatingTabBar(props: FloatingTabBarProps) {
  const isDark = useThemeMode() === 'dark';
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [barWidth, setBarWidth] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const translateX = useSharedValue(0);
  const hasPositioned = useRef(false);

  // Android resizes the window for the keyboard, which would leave a floating
  // bar stranded mid-screen just above it. iOS overlays the keyboard instead,
  // so the bar stays put and hiding it there would only cause a needless jump.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const items: FloatingTabItem[] =
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
              color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR,
              size: 23,
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
            } satisfies FloatingTabItem;
          })
      : props.tabs;

  // Index within the rendered list, not props.state.index — hidden routes
  // (approvals for non-admins, search) are filtered out above, so the two
  // diverge and the pill would land on the wrong tab.
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.active)
  );
  const tabWidth = items.length > 0 ? barWidth / items.length : 0;

  useEffect(() => {
    if (!tabWidth) return;
    const target = activeIndex * tabWidth + PILL_GAP;

    // Jump into place on first measure; animate every move after that.
    if (!hasPositioned.current) {
      hasPositioned.current = true;
      translateX.value = target;
      return;
    }

    translateX.value = withTiming(target, { duration: 240 });
  }, [activeIndex, tabWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setBarWidth((current) => (current === next ? current : next));
  };

  if (keyboardVisible) return null;

  return (
    <View pointerEvents="box-none" style={styles.shell}>
      <View
        onLayout={handleLayout}
        pointerEvents="box-none"
        style={[
          styles.bar,
          { marginBottom: Math.max(insets.bottom, EDGE_MARGIN) },
          isDark ? styles.shadowDark : styles.shadowLight,
          // Android draws its elevation shadow from the view's outline, which
          // only exists once the view has a background — and a near-transparent
          // one produces a shadow too faint to see. This fill is fully occluded
          // by the blur + wash stacked on top of it, so the opacity only costs
          // us a little frost depth on Android and buys a real shadow.
          Platform.OS === 'android' && (isDark ? styles.barDark : styles.barLight),
        ]}>
        {/* Rounded corners have to clip the blur, but the clipping view cannot
            also carry the shadow — Android drops an elevation shadow whenever
            overflow is hidden. Hence shadow outside, clip inside. */}
        <View style={styles.clip}>
          <BlurView
            intensity={Platform.OS === 'android' ? 60 : 40}
            tint={isDark ? 'dark' : 'light'}
            // expo-blur 15 (SDK 54) blurs the window content beneath the view.
            // Without this prop Android falls back to a plain translucent fill.
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
            style={StyleSheet.absoluteFill}
          />
          {/* Blur alone leaves the bar too transparent to read 11px labels
              against busy content, so a wash sits on top of it. Above the
              BlurView, so it is not itself captured and re-blurred. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              isDark ? styles.washDark : styles.washLight,
            ]}
          />

          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pill,
                { width: Math.max(tabWidth - PILL_GAP * 2, 0) },
                pillStyle,
              ]}
            />
          ) : null}

          {items.map((item) => (
            <TabButton key={item.key} item={item} width={tabWidth} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pinned over the screen rather than sitting in the navigator's layout flow,
  // so content scrolls visibly through the gaps and under the blur. Screens
  // pad their own scroll content by insets.bottom + ~120-128 to clear it.
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: EDGE_MARGIN,
    // Headroom for the upward half of the drop shadow. Android clips a child's
    // elevation shadow to the parent's bounds, so without this the glow above
    // the bar is shaved off; `overflow: visible` is belt-and-braces for the
    // same thing. box-none on the view keeps the padding non-blocking.
    paddingTop: Spacing.four,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
  },
  clip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },
  // Sits behind the blur on Android purely so elevation has an outline to cast
  // a shadow from. Opaque because a translucent outline yields a shadow too
  // faint to see; the blur and wash above it hide the fill entirely.
  barLight: {
    backgroundColor: '#FFFFFF',
  },
  barDark: {
    backgroundColor: '#1A1E2C',
  },
  // Layered over the blur to keep 11px labels legible against busy content.
  washLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  washDark: {
    backgroundColor: 'rgba(26, 30, 44, 0.55)',
  },
  shadowLight: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 12,
  },
  shadowDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: BAR_RADIUS - PILL_INSET,
    backgroundColor: ACTIVE_PILL_COLOR,
  },
  flexItem: {
    flex: 1,
  },
  pressable: {
    minHeight: Size.minTouchTarget,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    position: 'relative',
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#EF4444',
    zIndex: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
  },
});
