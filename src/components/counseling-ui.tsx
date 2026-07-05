import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Palette = (typeof Colors)[keyof typeof Colors];

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
};

export type SessionCardData = {
  title: string;
  counselor: string;
  note: string;
  date: string;
  time: string;
  accent: string;
};

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

type ScreenBackgroundProps = {
  palette: Palette;
  children: ReactNode;
};

type TagProps = {
  label: string;
  active?: boolean;
  compact?: boolean;
};

type SearchFieldProps = {
  placeholder: string;
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

type StatBadgeProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
};

export function ScreenBackground({ palette, children }: ScreenBackgroundProps) {
  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      {children}
    </View>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: ScreenHeaderProps) {
  return (
    <View style={styles.headerBlock}>
      {eyebrow ? <View style={styles.eyebrowPill}><TextInPill>{eyebrow}</TextInPill></View> : null}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <ThemedHeading>{title}</ThemedHeading>
          {subtitle ? <ThemedSubheading>{subtitle}</ThemedSubheading> : null}
        </View>
        {actionLabel ? (
          <Pressable onPress={onActionPress} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
            <SmallLabel>{actionLabel}</SmallLabel>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <SectionTitle>{title}</SectionTitle>
      {actionLabel ? (
        <Pressable onPress={onActionPress} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}>
          <SmallLabel>{actionLabel}</SmallLabel>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SearchField({ placeholder }: SearchFieldProps) {
  return (
    <View style={styles.searchField}>
      <MaterialCommunityIcons name="magnify" size={22} color={Colors.light.textSecondary} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textSecondary}
        style={styles.searchInput}
      />
    </View>
  );
}

export function Tag({ label, active, compact }: TagProps) {
  return (
    <View
      style={[
        styles.tag,
        active ? styles.tagActive : styles.tagIdle,
        compact && styles.tagCompact,
      ]}>
      <SmallLabel style={active ? styles.tagActiveText : undefined}>{label}</SmallLabel>
    </View>
  );
}

export function CounselorCard({ counselor, ctaLabel = 'Book', onPress }: CounselorCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.counselorCard,
        pressed && styles.pressed,
        { backgroundColor: counselor.background || Colors.light.surfaceRaised },
      ]}>
      <View style={styles.counselorTopRow}>
        <View style={[styles.avatar, { backgroundColor: counselor.foreground || Colors.light.primary }]}>
          <CardInitial>{counselor.initials}</CardInitial>
        </View>
        <View style={styles.counselorMeta}>
          <CardTitle>{counselor.name}</CardTitle>
          <CardSubtitle>{counselor.specialty}</CardSubtitle>
          <CardSubtitle>{counselor.availability}</CardSubtitle>
        </View>
        <View style={styles.ratingBadge}>
          <MaterialCommunityIcons name="star" size={14} color={Colors.light.warning} />
          <SmallLabel>{counselor.rating}</SmallLabel>
        </View>
      </View>
      <View style={styles.highlightRow}>
        {counselor.highlights.map((item) => (
          <View key={item} style={styles.highlightPill}>
            <SmallLabel>{item}</SmallLabel>
          </View>
        ))}
      </View>
      <View style={styles.counselorBottomRow}>
        <View style={styles.slotPill}>
          <MaterialCommunityIcons name="calendar-clock" size={15} color={Colors.light.primary} />
          <SmallLabel>{counselor.nextSlot}</SmallLabel>
        </View>
        <Link
          href={{ pathname: '/booking/[counselor]', params: { counselor: counselor.id } }}
          asChild>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <SmallLabel style={styles.primaryButtonText}>{ctaLabel}</SmallLabel>
          </Pressable>
        </Link>
      </View>
    </Pressable>
  );
}

export function SessionCard({ session, actionLabel = 'Join', onPress }: SessionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sessionCard,
        pressed && styles.pressed,
        { backgroundColor: session.accent },
      ]}>
      <View style={styles.sessionHeader}>
        <View>
          <CardTitle style={styles.sessionTitle}>{session.title}</CardTitle>
          <CardSubtitle style={styles.sessionSubtitle}>{session.counselor}</CardSubtitle>
        </View>
        <View style={styles.sessionBadge}>
          <MaterialCommunityIcons name="video" size={16} color={Colors.light.surfaceRaised} />
          <SmallLabel style={styles.sessionBadgeText}>{session.date}</SmallLabel>
        </View>
      </View>
      <View style={styles.sessionFooter}>
        <CardSubtitle style={styles.sessionNote}>{session.note}</CardSubtitle>
        <View style={styles.sessionTimeRow}>
          <MaterialCommunityIcons name="clock-outline" size={15} color={Colors.light.surfaceRaised} />
          <SmallLabel style={styles.sessionTime}>{session.time}</SmallLabel>
        </View>
        <View style={styles.secondaryButton}>
          <SmallLabel style={styles.secondaryButtonText}>{actionLabel}</SmallLabel>
        </View>
      </View>
    </Pressable>
  );
}

export function StatBadge({ icon, label, value }: StatBadgeProps) {
  return (
    <View style={styles.statBadge}>
      <MaterialCommunityIcons name={icon} size={18} color={Colors.light.primary} />
      <View>
        <SmallLabel>{label}</SmallLabel>
        <CardTitle style={styles.statValue}>{value}</CardTitle>
      </View>
    </View>
  );
}

export function SectionCard({ children }: { children: ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

export function TinyPill({ children }: { children: ReactNode }) {
  return <View style={styles.tinyPill}>{children}</View>;
}

function ThemedHeading({ children }: { children: ReactNode }) {
  return <View><Text style={styles.heading}>{children}</Text></View>;
}

function ThemedSubheading({ children }: { children: ReactNode }) {
  return <Text style={styles.subheading}>{children}</Text>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SmallLabel({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.smallLabel, style]}>{children}</Text>;
}

function TextInPill({ children }: { children: ReactNode }) {
  return <Text style={styles.pillLabel}>{children}</Text>;
}

function CardTitle({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.cardTitle, style]}>{children}</Text>;
}

function CardSubtitle({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.cardSubtitle, style]}>{children}</Text>;
}

function CardInitial({ children }: { children: ReactNode }) {
  return <Text style={styles.cardInitial}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  glowTop: {
    display: 'none',
  },
  headerBlock: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: Colors.light.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pillLabel: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    color: Colors.light.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  subheading: {
    marginTop: Spacing.one,
    color: Colors.light.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  headerAction: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    color: Colors.light.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionAction: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  smallLabel: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.light.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.light.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tagIdle: {
    backgroundColor: Colors.light.surfaceRaised,
    borderColor: Colors.light.border,
  },
  tagActive: {
    backgroundColor: Colors.light.primarySoft,
    borderColor: Colors.light.primarySoft,
  },
  tagActiveText: {
    color: Colors.light.primary,
  },
  tagCompact: {
    paddingVertical: Spacing.one,
  },
  counselorCard: {
    borderRadius: 26,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: Colors.light.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.light.border,
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
  },
  cardInitial: {
    color: Colors.light.surfaceRaised,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  counselorMeta: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: Colors.light.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: Colors.light.surfaceRaised,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  highlightPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    backgroundColor: Colors.light.surfaceRaised,
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
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.surfaceRaised,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.primary,
  },
  primaryButtonText: {
    color: Colors.light.surfaceRaised,
  },
  sessionCard: {
    borderRadius: 28,
    padding: Spacing.four,
    gap: Spacing.four,
    shadowColor: Colors.light.shadow,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sessionTitle: {
    color: Colors.light.surfaceRaised,
  },
  sessionSubtitle: {
    color: 'rgba(255,255,255,0.88)',
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  sessionBadgeText: {
    color: Colors.light.surfaceRaised,
  },
  sessionFooter: {
    gap: Spacing.two,
  },
  sessionNote: {
    color: 'rgba(255,255,255,0.95)',
  },
  sessionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sessionTime: {
    color: Colors.light.surfaceRaised,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  secondaryButtonText: {
    color: Colors.light.surfaceRaised,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 140,
    borderRadius: 22,
    padding: Spacing.three,
    backgroundColor: Colors.light.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statValue: {
    fontSize: 16,
  },
  sectionCard: {
    borderRadius: 26,
    padding: Spacing.four,
    backgroundColor: Colors.light.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tinyPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: Colors.light.surfaceMuted,
  },
  pressed: {
    opacity: 0.78,
  },
});
