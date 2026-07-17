import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Card } from '@/components/ui';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  MaxContentWidth,
  Shadows,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import {
  fetchAppointments,
  fetchCounselors,
  SupabaseAppointment,
  SupabaseCounselor,
} from '@/lib/supabase-db';

import { getCounselorPhoto } from '@/lib/counselor-utils';
export { getCounselorPhoto };

export default function MySessionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [appointments, setAppointments] = useState<SupabaseAppointment[]>([]);
  const [counselors, setCounselors] = useState<SupabaseCounselor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const loadSessionsList = async () => {
    try {
      const list = await fetchAppointments(currentUserId, 'student');
      setAppointments(list);

      const counselorList = await fetchCounselors();
      setCounselors(counselorList);
    } catch (err) {
      console.warn('Error fetching appointments list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Automatically refresh when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadSessionsList();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const upcomingSessions = appointments.filter((a) => ['pending', 'accepted'].includes(a.status));
  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

  // Filter counselors by search text
  const filteredCounselors = counselors.filter((c) => {
    const name = c.profile?.name || 'Counselor';
    const specialty = c.specialties.join(', ') || '';
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      specialty.toLowerCase().includes(search.toLowerCase())
    );
  });

  const getCardGradient = (index: number) => {
    const gradients = [
      ['#8B1C28', '#4A0A10'], // Maroon/red for John Doe
      ['#3F42DF', '#1A1C70'], // Dark Indigo for Sarah
      ['#5B4FE5', '#241B7A'], // Purple
      ['#0F766E', '#115E59'], // Dark Teal
    ];
    return gradients[index % gradients.length];
  };

  const handleOverflowPress = () => {
    Alert.alert(
      'Care Options',
      'Manage your care plan settings or contact support.',
      [
        { text: 'Care Plan Settings', onPress: () => console.log('Settings pressed') },
        { text: 'Help & Support', onPress: () => console.log('Help pressed') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleViewFullJourney = () => {
    Alert.alert(
      'Counseling Journey',
      'Step 3 of 5: Individual Therapy. You have completed Initial Intake and Assessment Review.',
      [{ text: 'Close', style: 'default' }]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header Title */}
          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>YOUR CARE PLAN</Text>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: theme.text }]}>My sessions</Text>
              <Pressable onPress={handleOverflowPress} style={styles.overflowBtn}>
                <MaterialCommunityIcons name="dots-horizontal" size={26} color={theme.text} />
              </Pressable>
            </View>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Track upcoming counseling sessions, notes, and progress at a glance.
            </Text>
          </View>

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="magnify" size={22} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              placeholder="Search counselor by name or specialty"
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>

          {/* Available Counselors Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Counselors Available</Text>
              <Pressable onPress={() => router.push('/search' as any)}>
                <Text style={[styles.viewAllText, { color: theme.primary }]}>View all</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: Spacing.four }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContainer}
              >
                {filteredCounselors.map((c, index) => {
                  const nameVal = c.profile?.name || 'Counselor';
                  const roleVal = c.specialties[0] || 'Peer Guide';
                  const ratingVal = c.rating ? c.rating.toFixed(1) : '5.0';
                  const imgUrl = getCounselorPhoto(nameVal, c.profile?.avatar_url);
                  const gradient = getCardGradient(index);

                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => router.push(`/counselor/${c.id}`)}
                      style={styles.carouselCardWrapper}
                    >
                      <LinearGradient
                        colors={gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.carouselCard}
                      >
                        {/* Info block */}
                        <View style={styles.cardInfoCol}>
                          <Text style={styles.availableTag}>AVAILABLE NOW</Text>
                          <Text numberOfLines={2} style={styles.cardName}>
                            {nameVal}
                          </Text>
                          <Text numberOfLines={1} style={styles.cardRole}>
                            {roleVal}
                          </Text>
                          <View style={styles.ratingPill}>
                            <Text style={styles.ratingText}>★ {ratingVal}</Text>
                          </View>
                        </View>

                        {/* Portrait Image block */}
                        <View style={styles.cardPortraitCol}>
                          <View style={styles.circularBackdrop} />
                          <Image source={{ uri: imgUrl }} style={styles.portraitImg} />
                        </View>
                      </LinearGradient>
                    </Pressable>
                  );
                })}

                {filteredCounselors.length === 0 && (
                  <Text style={[styles.emptyCarouselText, { color: theme.textSecondary }]}>
                    {`No counselors found matching "${search}".`}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>

          {/* Upcoming Session card */}
          {nextSession ? (
            <Card variant="raised" padding="four" style={styles.upcomingCard}>
              <View style={styles.upcomingTopRow}>
                <View style={styles.upcomingTextBlock}>
                  <Text style={styles.upcomingLabel}>Upcoming Session</Text>
                  <Text style={styles.upcomingCounselor}>
                    {nextSession.counselor_profile?.name || 'Counselor'} — Student counselor
                  </Text>
                </View>
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>
                    📅 {new Date(nextSession.appointment_date).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              </View>

              {/* Inner Focus Concern Sub-card */}
              <View style={styles.focusConcernCard}>
                <View style={styles.videoIconCircle}>
                  <MaterialCommunityIcons name="video" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.focusTextContainer}>
                  <Text style={styles.focusLabel}>FOCUS CONCERN</Text>
                  <Text style={styles.focusTopic} numberOfLines={2}>
                    {nextSession.topic || 'Academic Stress Management'}
                  </Text>
                </View>
              </View>

              <View style={styles.upcomingFooter}>
                <View style={styles.timeRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.upcomingTime}>
                    {nextSession.time_slot} ({nextSession.status.toUpperCase()})
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/video-call',
                      params: {
                        counselorName: nextSession.counselor_profile?.name || 'Counselor',
                        counselorId: nextSession.counselor_id,
                        callType: 'video',
                      },
                    })
                  }
                  style={({ pressed }) => [
                    styles.joinButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.joinButtonText}>Join call</Text>
                </Pressable>
              </View>
            </Card>
          ) : (
            <Card variant="surface" padding="four" style={[styles.upcomingCard, styles.upcomingEmptyCard]}>
              <View style={styles.upcomingTopRow}>
                <View style={styles.upcomingTextBlock}>
                  <Text style={styles.upcomingLabel}>Upcoming Session</Text>
                  <Text style={styles.upcomingCounselor}>No upcoming sessions</Text>
                </View>
              </View>
              <View style={[styles.focusConcernCard, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={styles.videoIconCircle}>
                  <MaterialCommunityIcons name="calendar-question" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.focusTextContainer}>
                  <Text style={styles.focusLabel}>GET STARTED</Text>
                  <Text style={styles.focusTopic}>Choose a counselor to schedule a call</Text>
                </View>
              </View>
              <View style={styles.upcomingFooter}>
                <View style={styles.timeRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.upcomingTime}>No appointments accepted</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/search' as any)}
                  style={({ pressed }) => [
                    styles.joinButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.joinButtonText}>Schedule</Text>
                </Pressable>
              </View>
            </Card>
          )}

          {/* Counseling Plan section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Counseling plan</Text>
              <Text style={styles.progressText}>Step 3 of 5</Text>
            </View>

            {/* List of Step Cards */}
            <View style={styles.stepsList}>
              {/* Step 1 */}
              <View style={[styles.stepCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.stepIconRow}>
                  <View style={[styles.statusIconCircle, styles.completedCircle]}>
                    <MaterialCommunityIcons name="check" size={18} color="#3F8C7A" />
                  </View>
                  <View style={styles.stepTextContainer}>
                    <Text style={[styles.stepTitle, { color: theme.text }]}>Initial Intake</Text>
                    <Text style={[styles.stepSubtext, { color: theme.textSecondary }]}>Completed on June 12</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </View>

              {/* Step 2 */}
              <View style={[styles.stepCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.stepIconRow}>
                  <View style={[styles.statusIconCircle, styles.completedCircle]}>
                    <MaterialCommunityIcons name="check" size={18} color="#3F8C7A" />
                  </View>
                  <View style={styles.stepTextContainer}>
                    <Text style={[styles.stepTitle, { color: theme.text }]}>Assessment Review</Text>
                    <Text style={[styles.stepSubtext, { color: theme.textSecondary }]}>Completed on June 20</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </View>

              {/* Step 3 */}
              <View style={[styles.stepCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.stepIconRow}>
                  <View style={[styles.statusIconCircle, styles.ongoingCircle]}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color="#5B4FE5" />
                  </View>
                  <View style={styles.stepTextContainer}>
                    <Text style={[styles.stepTitle, { color: theme.text }]}>Individual Therapy</Text>
                    <Text style={[styles.stepSubtext, { color: theme.textSecondary }]}>Ongoing — 4 sessions left</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </View>

            {/* Dashed Border Button */}
            <Pressable
              onPress={handleViewFullJourney}
              style={({ pressed }) => [
                styles.journeyButton,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.journeyButtonText, { color: theme.textSecondary }]}>
                View Full Journey →
              </Text>
            </Pressable>
          </View>
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
  titleBlock: {
    gap: Spacing.one,
  },
  eyebrow: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.8,
  },
  overflowBtn: {
    padding: Spacing.one,
  },
  subtitle: {
    fontSize: FontSize.body - 1,
    lineHeight: 22,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    ...Shadows.light.card,
  },
  searchIcon: {
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body - 1,
    paddingVertical: 0,
  },
  sectionContainer: {
    gap: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: FontSize.h3 + 1,
    fontWeight: FontWeight.bold,
  },
  viewAllText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.semibold,
  },
  progressText: {
    fontSize: FontSize.caption,
    color: '#6B7280',
    fontWeight: FontWeight.medium,
  },
  carouselContainer: {
    paddingRight: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  carouselCardWrapper: {
    width: 250,
    height: 140,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.light.card,
  },
  carouselCard: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.three,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoCol: {
    flex: 1.2,
    gap: 2,
    justifyContent: 'center',
  },
  availableTag: {
    fontSize: 9,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.76)',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardName: {
    fontSize: FontSize.body + 1,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  cardRole: {
    fontSize: FontSize.caption,
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '500',
    marginBottom: 4,
  },
  ratingPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardPortraitCol: {
    width: 86,
    height: 86,
    borderRadius: 43,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.one,
  },
  circularBackdrop: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  portraitImg: {
    width: 82,
    height: 82,
    borderRadius: 41,
    resizeMode: 'cover',
  },
  emptyCarouselText: {
    fontSize: FontSize.caption + 1,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
  },
  upcomingCard: {
    backgroundColor: '#5B5FEF',
    borderColor: '#5B5FEF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Shadows.light.raised,
  },
  upcomingEmptyCard: {
    backgroundColor: '#7679F4',
    borderColor: '#7679F4',
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  upcomingTextBlock: {
    flex: 1,
    gap: 2,
  },
  upcomingLabel: {
    color: '#FFFFFF',
    fontSize: FontSize.h3 + 1,
    fontWeight: FontWeight.bold,
  },
  upcomingCounselor: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: FontSize.body - 1,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  datePillText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  focusConcernCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  videoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTextContainer: {
    flex: 1,
    gap: 2,
  },
  focusLabel: {
    fontSize: FontSize.small - 1,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
  },
  focusTopic: {
    fontSize: FontSize.body - 1,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  upcomingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  upcomingTime: {
    color: '#FFFFFF',
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  joinButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 18,
    paddingVertical: 8,
    ...Shadows.light.card,
  },
  joinButtonText: {
    color: '#5B5FEF',
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  stepsList: {
    gap: Spacing.two,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Shadows.light.card,
  },
  stepIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  statusIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCircle: {
    backgroundColor: '#E6F4EA',
  },
  ongoingCircle: {
    backgroundColor: '#EAE8FF',
  },
  stepTextContainer: {
    gap: 2,
  },
  stepTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  stepSubtext: {
    fontSize: FontSize.caption,
  },
  journeyButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  journeyButtonText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.semibold,
  },
  pressed: {
    opacity: 0.76,
  },
});
