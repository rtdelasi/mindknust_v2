import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TagProps = {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Tag({ label, active, icon, onPress, style }: TagProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: active ? theme.primarySoft : theme.surfaceRaised,
          borderColor: active ? theme.primarySoft : theme.border,
          borderRadius: BorderRadius.full,
          opacity: pressed ? 0.82 : 1,
        },
        style,
      ]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          {
            color: active ? theme.primary : theme.text,
            fontSize: FontSize.caption,
            fontWeight: FontWeight.semibold,
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const Pill = Tag;

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: 0.1,
  },
});
