import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const router = useRouter();

  const handlePress = onPress || (() => router.push({ pathname: '/counselor/[id]', params: { id } }));

  if (variant === 'horizontal') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.horizontalCard,
          {
            backgroundColor: theme.surfaceRaised,
            borderColor: theme.border,
          },
          pressed && styles.pressed,
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
            <MaterialCommunityIcons name="star" size={13} color="#FFB000" />
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
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.verticalCard,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
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
          <MaterialCommunityIcons name="star" size={13} color="#FFB000" />
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
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  horizontalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.three,
  },
  horizontalImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
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
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.two,
    alignItems: 'center',
  },
  verticalImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E5E7EB',
  },
  verticalInfo: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  name: {
    fontSize: FontSize.body - 1,
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
    fontSize: FontSize.small - 1,
  },
});
