import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CounselorCard, CounselorCardData } from '@/components/counseling-ui';
import { SearchBar } from '@/components/ui/search-bar';
import { SectionHeader } from '@/components/ui/section-header';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  MaxContentWidth,
  Shadows,
  Size,
  Spacing,
} from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { fetchCounselors, SupabaseCounselor } from '@/lib/supabase-db';
import { getCounselorPhoto } from '@/lib/counselor-utils';

const categories = [
  { id: 'anxiety', label: 'Anxiety', icon: 'brain' },
  { id: 'stress', label: 'Stress', icon: 'heart-pulse' },
  { id: 'relationships', label: 'Relationships', icon: 'account-group-outline' },
  { id: 'academic', label: 'Academic support', icon: 'school-outline' },
] as const;

function mapCounselorToCard(c: SupabaseCounselor): CounselorCardData {
  const name = c.profile?.name || 'Counselor';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return {
    id: c.id,
    name,
    specialty: c.specialties[0] || 'Peer Guide',
    rating: c.rating ? c.rating.toFixed(1) : '5.0',
    nextSlot: 'Available now',
    availability: `Available now`,
    initials,
    background: '',
    foreground: '',
    highlights: c.specialties.slice(0, 3),
    photoUrl: getCounselorPhoto(name, c.profile?.avatar_url),
  };
}

export default function SearchCounselorScreen() {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const shadow = isDark ? Shadows.dark : Shadows.light;

  const [counselors, setCounselors] = useState<SupabaseCounselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCounselors();
        setCounselors(list);
      } catch (err) {
        console.warn('Failed to fetch counselors:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = counselors.filter((c) => {
    const name = c.profile?.name || '';
    const specs = c.specialties.join(' ');
    const matchesSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      specs.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      !activeCategory ||
      c.specialties.some((s) => s.toLowerCase().includes(activeCategory.toLowerCase()));
    return matchesSearch && matchesCategory;
  });

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
            <View style={[styles.eyebrowWrap, { backgroundColor: theme.surfaceRaised }, shadow.small]}>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>Find support</Text>
            </View>
            <Pressable style={[styles.bellButton, { backgroundColor: theme.surfaceRaised }]} onPress={() => router.push('/notifications')}>
              <MaterialCommunityIcons name="bell-outline" size={Size.iconMd} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: theme.text }]}>Search counselor</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Explore licensed counselors by concern, style, or availability.
            </Text>
          </View>

          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="What would you like help with?"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            {categories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setActiveCategory(isActive ? null : category.id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isActive ? theme.primarySoft : theme.surfaceRaised,
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name={category.icon}
                    size={Size.iconSm}
                    color={isActive ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: isActive ? theme.primary : theme.textSecondary },
                    ]}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <SectionHeader title="Available counselors" />

          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: Spacing.four }} />
          ) : (
            <View style={styles.cardStack}>
              {filtered.length > 0 ? (
                filtered.map((c) => (
                  <CounselorCard
                    key={c.id}
                    counselor={mapCounselorToCard(c)}
                    ctaLabel="Book session"
                    onPress={() =>
                      router.push({
                        pathname: '/booking/[counselor]',
                        params: { counselor: c.id },
                      })
                    }
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="account-search-outline" size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    {search ? `No counselors match "${search}"` : 'No counselors available right now.'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  eyebrow: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: FontWeight.extrabold,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: FontSize.bodySm,
    lineHeight: 22,
  },
  categoryRow: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  categoryLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  cardStack: {
    gap: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  emptyText: {
    fontSize: FontSize.bodySm,
    textAlign: 'center',
  },
});
