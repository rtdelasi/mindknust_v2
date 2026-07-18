import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SectionHeaderProps = {
  title: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {typeof title === 'string' ? (
        <Text
          style={[
            styles.title,
            {
              color: theme.text,
              fontSize: FontSize.h3,
              fontWeight: FontWeight.bold,
            },
          ]}>
          {title}
        </Text>
      ) : (
        title
      )}
      {actionLabel ? (
        <Pressable onPress={onActionPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text
            style={[
              styles.actionLabel,
              {
                color: theme.textSecondary,
                fontSize: FontSize.caption,
                fontWeight: FontWeight.semibold,
              },
            ]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    letterSpacing: -0.2,
  },
  action: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: BorderRadius.full,
  },
  actionLabel: {
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.72,
  },
});
