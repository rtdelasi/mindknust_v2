import { ImageSourcePropType, StyleSheet, Text, View, Image } from 'react-native';

import { FontSize, FontWeight, Size, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type AvatarProps = {
  name?: string;
  source?: ImageSourcePropType;
  size?: AvatarSize;
};

const avatarSizes = {
  xs: Size.avatarXs,
  sm: Size.avatarSm,
  md: Size.avatarMd,
  lg: Size.avatarLg,
  xl: Size.avatarXl,
} as const;

export function Avatar({ name, source, size = 'md' }: AvatarProps) {
  const theme = useTheme();
  const dimension = avatarSizes[size];
  const initials = getInitials(name);

  if (source) {
    return <Image source={source} style={[styles.image, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: theme.surfaceSoft }]} />;
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
        },
      ]}>
      <Text
        style={[
          styles.initials,
          {
            color: theme.primary,
            fontSize: size === 'xl' ? FontSize.h2 : size === 'lg' ? FontSize.h3 : FontSize.body,
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
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    letterSpacing: 0.4,
  },
});
