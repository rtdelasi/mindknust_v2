import { ImageSourcePropType, StyleSheet, Text, View, Image } from 'react-native';

import { Colors, FontSize, FontWeight, Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AvatarSize = 'sm' | 'md' | 'lg';

type AvatarProps = {
  name?: string;
  source?: ImageSourcePropType;
  size?: AvatarSize;
};

const avatarSizes = {
  sm: Size.avatarSm,
  md: Size.avatarMd,
  lg: Size.avatarLg,
} as const;

export function Avatar({ name, source, size = 'md' }: AvatarProps) {
  const theme = useTheme();
  const dimension = avatarSizes[size];
  const initials = getInitials(name);

  if (source) {
    return <Image source={source} style={[styles.image, { width: dimension, height: dimension, borderRadius: dimension / 2 }]} />;
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: theme.primarySoft,
          borderColor: theme.border,
        },
      ]}>
      <Text
        style={[
          styles.initials,
          {
            color: theme.primary,
            fontSize: size === 'lg' ? FontSize.h3 : FontSize.body,
            fontWeight: FontWeight.bold,
          },
        ]}>
        {initials}
      </Text>
    </View>
  );
}

function getInitials(name?: string) {
  if (!name) {
    return '?';
  }

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: Colors.light.surfaceSoft,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initials: {
    letterSpacing: 0.4,
  },
});
