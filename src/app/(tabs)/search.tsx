import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CounselorCardData, CounselorCard } from '@/components/counseling-ui';
import { Card } from '@/components/ui/card';
import { SearchBar } from '@/components/ui/search-bar';
import { SectionHeader } from '@/components/ui/section-header';
import { BorderRadius, Colors, MaxContentWidth, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const categories = [
  { id: 'anxiety', label: 'Anxiety', icon: 'brain' },
  { id: 'stress', label: 'Stress', icon: 'heart-pulse' },
  { id: 'relationships', label: 'Relationships', icon: 'account-group-outline' },
  { id: 'academic', label: 'Academic support', icon: 'school-outline' },
] as const;

const counselors: CounselorCardData[] = [
  {
    id: 'selina-badu',
    name: 'Selina Badu',
    specialty: 'Anxiety & self-esteem',
    rating: '5.0',
    nextSlot: 'Available today',
    availability: 'Online - 15 min response',
    initials: 'SB',
    background: '#F6F0E4',
    foreground: Colors.light.primary,
    highlights: ['Anxiety', 'Supportive'],
  },
  {
    id: 'yaw-mensah',
    name: 'Yaw Mensah',
    specialty: 'Student life coaching',
    rating: '4.8',
    nextSlot: 'Open Fri 10:00 AM',
    availability: 'Hybrid - Main campus',
    initials: 'YM',
    background: '#EEF7F5',
    foreground: '#6B6FF2',
    highlights: ['Focus', 'Confidence'],
  },
  {
    id: 'nana-serwaa',
    name: 'Nana Serwaa',
    specialty: 'Relationships & recovery',
    rating: '4.9',
    nextSlot: 'Open Sat 1:00 PM',
    availability: 'Online - Evening hours',
    initials: 'NS',
    background: '#F3EDF8',
    foreground: Colors.light.accent,
    highlights: ['Relationships', 'Trauma-informed'],
  },
];


export default function SearchCounselorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 128 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View style={styles.eyebrowWrap}>
              <Text style={styles.eyebrow}>Find support</Text>
            </View>
            <Pressable style={styles.bellButton} onPress={() => router.push('/notifications')}>
              <MaterialCommunityIcons name="bell-outline" size={Size.iconMd} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Search counselor</Text>
            <Text style={styles.subtitle}>
              Explore licensed counselors by concern, style, or availability.
            </Text>
          </View>

          <SearchBar placeholder="What would you like help with?" />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            {categories.map((category, index) => (
              <CategoryCard
                key={category.id}
                label={category.label}
                icon={category.icon}
                active={index === 0}
              />
            ))}
          </ScrollView>

          <SectionHeader title="Available counselors" actionLabel="Filter" />

          <View style={styles.cardStack}>
            {counselors.map((counselor) => (
              <CounselorCard
                key={counselor.id}
                counselor={counselor}
                ctaLabel="Book session"
                onPress={() =>
                  router.push({
                    pathname: '/booking/[counselor]',
                    params: { counselor: counselor.id },
                  })
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function CategoryCard({
  label,
  icon,
  active,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  active?: boolean;
}) {
  return (
    <Card
      variant="raised"
      padding="two"
      style={[
        styles.categoryCard,
        active && styles.categoryCardActive,
      ]}>
      <View style={styles.categoryIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={Size.iconLg}
          color={active ? Colors.light.primary : Colors.light.primary}
        />
      </View>
      <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  eyebrowWrap: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.surfaceRaised,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.light.card,
  },
  eyebrow: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.light.card,
  },
  titleBlock: {
    gap: Spacing.one,
  },
  title: {
    color: Colors.light.text,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: Colors.light.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  categoryRow: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },
  categoryCard: {
    width: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  categoryCardActive: {
    borderColor: Colors.light.primarySoft,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primarySoft,
  },
  categoryLabel: {
    textAlign: 'center',
    color: Colors.light.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  categoryLabelActive: {
    color: Colors.light.primary,
  },
  cardStack: {
    gap: Spacing.three,
  },
});
