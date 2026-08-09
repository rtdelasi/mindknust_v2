import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

export type CounselorCardData = {
  id: string;
  name: string;
  specialty: string;
  rating: string;
  nextSlot: string;
  availability: string;
  initials: string;
  background: string;
  foreground: string;
  highlights: string[];
  /** Avatar image. Falls back to initials when absent or the load fails. */
  photoUrl?: string;
};

export type SessionCardData = {
  title: string;
  counselor: string;
  note: string;
  date: string;
  time: string;
  accent: string;
};

type CounselorCardProps = {
  counselor: CounselorCardData;
  ctaLabel?: string;
  onPress?: () => void;
};

type SessionCardProps = {
  session: SessionCardData;
  actionLabel?: string;
  onPress?: () => void;
};

export function CounselorCard({ counselor, ctaLabel = 'Book session', onPress }: CounselorCardProps) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;
  const router = useRouter();
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!counselor.photoUrl && !photoFailed;

  const handleCardPress =
    onPress || (() => router.push({ pathname: '/counselor/[id]', params: { id: counselor.id } }));

  return (
    <Pressable
      onPress={handleCardPress}
      style={({ pressed }) => [
        styles.counselorCard,
        pressed && styles.pressed,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
        },
        shadow.card,
      ]}>
      {/* Top Header Row */}
      <View style={styles.counselorTopRow}>
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
            {showPhoto ? (
              <Image
                source={{ uri: counselor.photoUrl }}
                style={styles.avatarImage}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <Text style={[styles.cardInitial, { color: theme.primary }]}>{counselor.initials}</Text>
            )}
          </View>
          <View style={[styles.onlineDot, { backgroundColor: theme.success, borderColor: theme.surfaceRaised }]} />
        </View>

        <View style={styles.counselorMeta}>
          <View style={styles.nameRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {counselor.name}
            </Text>
            <MaterialCommunityIcons name="check-decagram" size={16} color={theme.primary} />
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.primary }]} numberOfLines={1}>
            {counselor.specialty}
          </Text>
          {counselor.availability ? (
            <Text style={[styles.cardQualification, { color: theme.textSecondary }]} numberOfLines={1}>
              {counselor.availability}
            </Text>
          ) : null}
        </View>

        <View style={[styles.ratingBadge, { backgroundColor: theme.warningSoft }]}>
          <MaterialCommunityIcons name="star" size={13} color={theme.warning} />
          <Text style={[styles.ratingText, { color: theme.warning }]}>{counselor.rating}</Text>
        </View>
      </View>

      {/* Specialty Highlights Pills */}
      {counselor.highlights && counselor.highlights.length > 0 && (
        <View style={styles.highlightRow}>
          {counselor.highlights.map((item) => (
            <View key={item} style={[styles.highlightPill, { backgroundColor: theme.surfaceSoft }]}>
              <Text style={[styles.highlightText, { color: theme.textSecondary }]}>#{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Card Footer */}
      <View style={[styles.counselorBottomRow, { borderTopColor: theme.border }]}>
        <View style={styles.slotPill}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={15} color={theme.primary} />
          <Text style={[styles.slotText, { color: theme.textSecondary }]}>
            {counselor.nextSlot || 'Available Today'}
          </Text>
        </View>

        <View style={styles.cardActionsRow}>
          <Pressable
            onPress={() => router.push({ pathname: '/counselor/[id]', params: { id: counselor.id } })}
            style={({ pressed }) => [
              styles.profileBtn,
              { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.profileBtnText, { color: theme.text }]}>Profile</Text>
          </Pressable>

          <Link
            href={{ pathname: '/booking/[counselor]', params: { counselor: counselor.id } }}
            asChild>
            <Pressable
              style={({ pressed }) => [
                styles.bookBtn,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="calendar-plus" size={15} color="#FFFFFF" />
              <Text style={styles.bookBtnText}>{ctaLabel}</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </Pressable>
  );
}

export function SessionCard({ session, actionLabel = 'Join', onPress }: SessionCardProps) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sessionCard,
        pressed && styles.pressed,
        { backgroundColor: session.accent },
        shadow.raised,
      ]}>
      <View style={styles.sessionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionTitle, { color: theme.textInverse }]}>{session.title}</Text>
          <Text style={[styles.sessionSubtitle, { color: 'rgba(255,255,255,0.88)' }]}>{session.counselor}</Text>
        </View>
        <View style={styles.sessionBadge}>
          <MaterialCommunityIcons name="video" size={16} color={theme.textInverse} />
          <Text style={[styles.sessionBadgeText, { color: theme.textInverse }]}>{session.date}</Text>
        </View>
      </View>
      <View style={styles.sessionFooter}>
        <Text style={[styles.sessionNote, { color: 'rgba(255,255,255,0.95)' }]}>{session.note}</Text>
        <View style={styles.sessionTimeRow}>
          <MaterialCommunityIcons name="clock-outline" size={15} color={theme.textInverse} />
          <Text style={[styles.sessionTime, { color: theme.textInverse }]}>{session.time}</Text>
        </View>
        <View style={[styles.secondaryButton, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <Text style={[styles.secondaryButtonText, { color: theme.textInverse }]}>{actionLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  counselorCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
  },
  counselorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  cardInitial: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
  counselorMeta: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTitle: {
    fontSize: FontSize.bodyLg - 1,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  cardQualification: {
    fontSize: FontSize.caption - 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ratingText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  highlightPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  highlightText: {
    fontSize: FontSize.caption - 1,
    fontWeight: FontWeight.medium,
  },
  counselorBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  slotText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  profileBtnText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  sessionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sessionTitle: {
    fontSize: FontSize.bodyLg,
    fontWeight: '700',
    marginBottom: 2,
  },
  sessionSubtitle: {
    fontSize: FontSize.caption,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  sessionBadgeText: {
    fontSize: FontSize.small,
    fontWeight: '600',
  },
  sessionFooter: {
    gap: Spacing.two,
  },
  sessionNote: {
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  sessionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sessionTime: {
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  secondaryButtonText: {
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
