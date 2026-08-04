import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, Shadows, Spacing } from '@/constants/theme';
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

export function CounselorCard({ counselor, ctaLabel = 'Book', onPress }: CounselorCardProps) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const shadow = isDark ? Shadows.dark : Shadows.light;
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!counselor.photoUrl && !photoFailed;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.counselorCard,
        pressed && styles.pressed,
        { backgroundColor: counselor.background || theme.surfaceRaised },
        shadow.card,
      ]}>
      <View style={styles.counselorTopRow}>
        <View style={[styles.avatar, { backgroundColor: counselor.foreground || theme.primary }]}>
          {showPhoto ? (
            <Image
              source={{ uri: counselor.photoUrl }}
              style={styles.avatarImage}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <Text style={[styles.cardInitial, { color: theme.textInverse }]}>{counselor.initials}</Text>
          )}
        </View>
        <View style={styles.counselorMeta}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{counselor.name}</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>{counselor.specialty}</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>{counselor.availability}</Text>
        </View>
        <View style={[styles.ratingBadge, { backgroundColor: theme.surfaceSoft }]}>
          <MaterialCommunityIcons name="star" size={14} color={theme.warning} />
          <Text style={[styles.smallLabel, { color: theme.text }]}>{counselor.rating}</Text>
        </View>
      </View>
      <View style={styles.highlightRow}>
        {counselor.highlights.map((item) => (
          <View key={item} style={[styles.highlightPill, { backgroundColor: theme.surfaceSoft }]}>
            <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={styles.counselorBottomRow}>
        <View style={[styles.slotPill, { backgroundColor: theme.surfaceSoft }]}>
          <MaterialCommunityIcons name="calendar-clock" size={15} color={theme.primary} />
          <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>{counselor.nextSlot}</Text>
        </View>
        <Link
          href={{ pathname: '/booking/[counselor]', params: { counselor: counselor.id } }}
          asChild>
          <Pressable style={({ pressed }) => [{ backgroundColor: theme.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two }, pressed && styles.pressed]}>
            <Text style={[styles.primaryButtonText, { color: theme.textInverse }]}>{ctaLabel}</Text>
          </Pressable>
        </Link>
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
  },
  counselorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cardInitial: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  counselorMeta: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: FontSize.bodyLg,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  smallLabel: {
    fontSize: FontSize.caption,
    lineHeight: 18,
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  highlightPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  counselorBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    fontSize: FontSize.caption,
    fontWeight: '700',
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
