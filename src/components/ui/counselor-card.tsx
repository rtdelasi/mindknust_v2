import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, FontSize, FontWeight, Spacing, Shadows, Timing } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { formatCounselorRating } from '@/lib/counselor-utils';

type CounselorCardProps = {
  id: string;
  name: string;
  specialty: string;
  photoUrl: string;
  rating?: number;
  reviewCount?: number;
  variant?: 'vertical' | 'horizontal';
  onPress?: () => void;
};

export function CounselorCard({
  id,
  name,
  specialty,
  photoUrl,
  rating,
  reviewCount,
  variant = 'vertical',
  onPress,
}: CounselorCardProps) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;
  const router = useRouter();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, Timing.springSnappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Timing.spring);
  };

  const handlePress = onPress || (() => router.push({ pathname: '/counselor/[id]', params: { id } }));

  const ratingData = formatCounselorRating(rating, reviewCount);

  if (variant === 'horizontal') {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.horizontalCard,
            {
              backgroundColor: theme.surfaceRaised,
              ...shadow.card,
            },
          ]}>
          <Image source={{ uri: photoUrl }} style={styles.horizontalImage} />
          <View style={styles.horizontalInfo}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.specialty, { color: theme.primary }]} numberOfLines={1}>
              {specialty}
            </Text>
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={13} color={theme.amber} />
              <Text style={[styles.ratingText, { color: theme.text }]}>
                {ratingData.display}
              </Text>
              {ratingData.countPostfix && (
                <Text style={[styles.reviewText, { color: theme.textSecondary }]}>
                  {ratingData.countPostfix}
                </Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={handlePress}
            style={[styles.bookmarkBtn, { backgroundColor: theme.surfaceSoft }]}>
            <MaterialCommunityIcons
              name="bookmark-outline"
              size={18}
              color={theme.primary}
            />
          </Pressable>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.verticalCard,
          {
            backgroundColor: theme.surfaceRaised,
            ...shadow.card,
          },
        ]}>
        <Image source={{ uri: photoUrl }} style={styles.verticalImage} />
        <View style={styles.verticalInfo}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.specialty, { color: theme.primary }]} numberOfLines={1}>
            {specialty}
          </Text>
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={13} color={theme.amber} />
            <Text style={[styles.ratingText, { color: theme.text }]}>
              {rating?.toFixed(1) || '5.0'}
            </Text>
            {reviewCount !== undefined && (
              <Text style={[styles.reviewText, { color: theme.textSecondary }]}>
                ({reviewCount})
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  horizontalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    gap: Spacing.three,
  },
  horizontalImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  horizontalInfo: {
    flex: 1,
    gap: 2,
  },
  bookmarkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalCard: {
    width: 160,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    gap: Spacing.two,
    alignItems: 'center',
  },
  verticalImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  verticalInfo: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  name: {
    fontSize: FontSize.bodySm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  specialty: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  reviewText: {
    fontSize: FontSize.micro,
  },
});
