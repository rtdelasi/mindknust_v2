import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, SectionHeader, Tag } from '@/components/ui';
import { BorderRadius, Colors, FontSize, FontWeight, MaxContentWidth, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { fetchAppointments, fetchCounselors, SupabaseAppointment, SupabaseCounselor } from '@/lib/supabase-db';

export const getCounselorPhoto = (counselorName: string, avatarUrl?: string) => {
  if (avatarUrl) return avatarUrl;
  const name = counselorName.toLowerCase();
  if (name.includes('victoria') || name.includes('adjei')) {
    return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300';
  }
  if (name.includes('joseph') || name.includes('asamoah')) {
    return 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300';
  }
  if (name.includes('nan') || name.includes('serwaa') || name.includes('selina') || name.includes('badu') || name.includes('amina')) {
    return 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300';
  }
  return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300'; // Default male
};

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

  // Divide appointments into upcoming (pending/accepted) and history (completed/declined)
  const upcomingSessions = appointments.filter(a => ['pending', 'accepted'].includes(a.status));
  const historySessions = appointments.filter(a => ['declined', 'completed'].includes(a.status));

  // Determine next active upcoming session
  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

  // Filter counselors by search text
  const filteredCounselors = counselors.filter((c) => {
    const name = c.profile?.name || 'Counselor';
    const specialty = c.specialties.join(', ') || '';
    return name.toLowerCase().includes(search.toLowerCase()) ||
      specialty.toLowerCase().includes(search.toLowerCase());
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
          {/* Header Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Your care plan</Text>
            <Text style={styles.title}>My sessions</Text>
            <Text style={styles.subtitle}>
              Track upcoming counseling sessions, notes, and progress at a glance.
            </Text>
          </View>

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="magnify" size={22} color={theme.textSecondary} />
            <TextInput
              placeholder="Search counselor by name or specialty..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>

          {/* Available Counselors Carousel */}
          <View style={styles.carouselSection}>
            <SectionHeader title="Counselors Available" />
            {loading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: Spacing.four }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
                {filteredCounselors.map((c) => {
                  const nameVal = c.profile?.name || 'Counselor';
                  const roleVal = c.specialties[0] || 'Peer Guide';
                  const imgUrl = getCounselorPhoto(nameVal, c.profile?.avatar_url);

                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => router.push(`/counselor/${c.id}`)}
                      style={styles.carouselCardWrapper}
                    >
                      <View style={styles.carouselCard}>
                        {/* Left Info block */}
                        <View style={styles.cardInfoCol}>
                          <Text numberOfLines={2} style={styles.cardName}>{nameVal}</Text>
                          <Text numberOfLines={1} style={styles.cardRole}>{roleVal}</Text>
                        </View>

                        {/* Right Portrait block with Circular Backdrop */}
                        <View style={styles.cardPortraitCol}>
                          <View style={styles.circularBackdrop} />
                          <Image source={{ uri: imgUrl }} style={styles.portraitImg} />
                        </View>
                      </View>
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

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <>
              {/* Upcoming Session card */}
              {nextSession ? (
                <Card variant="raised" padding="four" style={styles.upcomingCard}>
                  <View style={styles.upcomingTopRow}>
                    <View style={styles.upcomingTextBlock}>
                      <Text style={styles.upcomingLabel}>Upcoming Session</Text>
                      <Text style={styles.upcomingCounselor}>
                        {nextSession.counselor_profile?.name || "Counselor"} - Student counselor
                      </Text>
                    </View>
                    <View style={styles.datePill}>
                      <MaterialCommunityIcons name="video" size={Size.iconSm} color={Colors.light.surfaceRaised} />
                      <Text style={styles.datePillText}>
                        {new Date(nextSession.appointment_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.upcomingNote}>
                    Focus concern: {nextSession.topic || 'General Support Check-in'}
                  </Text>
                  <View style={styles.upcomingFooter}>
                    <View style={styles.timeRow}>
                      <MaterialCommunityIcons name="clock-outline" size={Size.iconSm} color={Colors.light.surfaceRaised} />
                      <Text style={styles.upcomingTime}>
                        {nextSession.time_slot} ({nextSession.status.toUpperCase()})
                      </Text>
                    </View>
                    <Button
                      label="Join call"
                      onPress={() => router.push('/video-call')}
                      variant="secondary"
                      style={styles.joinButton}
                    />
                  </View>
                </Card>
              ) : (
                <Card variant="surface" padding="four" style={styles.emptyCard}>
                  <MaterialCommunityIcons name="calendar-question" size={32} color={theme.textSecondary} />
                  <Text style={[styles.emptyCardTitle, { color: theme.text }]}>No upcoming sessions</Text>
                  <Text style={[styles.emptyCardText, { color: theme.textSecondary }]}>
                    Select an active counselor from the carousel above to schedule your next wellness appointment.
                  </Text>
                </Card>
              )}

              {/* Counseling plans details */}
              <Card variant="surface" padding="four">
                <SectionHeader title="Counseling plan" />
                <View style={styles.planRow}>
                  <Tag label="Wellbeing" active />
                  <Tag label="Routine" />
                  <Tag label="Progress" />
                </View>
                <Text style={styles.planTitle}>What we are focusing on</Text>
                <Text style={styles.planBody}>
                  Build a calmer weekday routine, reduce study pressure, and keep weekly check-ins moving.
                </Text>
              </Card>

              {/* History sessions lists */}
              {historySessions.length > 0 && (
                <View style={styles.historyBlock}>
                  <SectionHeader title="Recent sessions" />
                  <View style={styles.cardStack}>
                    {historySessions.map((session) => (
                      <Card key={session.id} variant="raised" padding="three" style={styles.historyCard}>
                        <View style={styles.historyTopRow}>
                          <View style={styles.historyTitleBlock}>
                            <Text style={styles.historyTitle}>
                              {session.topic || 'Counseling Session'}
                            </Text>
                            <Text style={styles.historyCounselor}>
                              {session.counselor_profile?.name || 'Counselor'}
                            </Text>
                          </View>
                          <View style={styles.historyDatePill}>
                            <MaterialCommunityIcons name="calendar" size={Size.iconSm} color={Colors.light.primary} />
                            <Text style={styles.historyDateText}>
                              {new Date(session.appointment_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.historyNote}>
                          Session completed. Topic was academic support and boundaries plan.
                        </Text>
                        <View style={styles.historyFooter}>
                          <Text style={styles.historyTime}>{session.time_slot}</Text>
                          <Button label="Review note" variant="secondary" />
                        </View>
                      </Card>
                    ))}
                  </View>
                </View>
              )}
            </>
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
  titleBlock: {
    gap: Spacing.one,
  },
  eyebrow: {
    color: Colors.light.primary,
    fontSize: FontSize.small + 1,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.light.text,
    fontSize: FontSize.h1,
    lineHeight: 36,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: Colors.light.textSecondary,
    fontSize: FontSize.body - 1,
    lineHeight: 22,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 54,
    borderRadius: BorderRadius.md + 4,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body - 1,
    paddingVertical: 0,
  },
  carouselSection: {
    gap: Spacing.two,
  },
  carouselContainer: {
    paddingRight: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  carouselCardWrapper: {
    width: 240,
    height: 136,
    borderRadius: BorderRadius.md + 4,
    overflow: 'hidden',
    ...Shadows.light.card,
  },
  carouselCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#8B1C28', // Maroon Red KNUST branding
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.three,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoCol: {
    flex: 1.2,
    gap: 4,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  cardRole: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.76)',
    fontWeight: '500',
  },
  cardPortraitCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  circularBackdrop: {
    position: 'absolute',
    bottom: -10,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  portraitImg: {
    width: 82,
    height: 110,
    borderRadius: 41,
    resizeMode: 'cover',
    zIndex: 1,
  },
  emptyCarouselText: {
    fontSize: FontSize.caption + 1,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
  },
  loadingContainer: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingCard: {
    gap: Spacing.three,
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
    ...Shadows.light.raised,
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  upcomingTextBlock: {
    flex: 1,
    gap: 4,
  },
  upcomingLabel: {
    color: Colors.light.surfaceRaised,
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  upcomingCounselor: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FontSize.body - 1,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  datePillText: {
    color: Colors.light.surfaceRaised,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  upcomingNote: {
    color: 'rgba(255,255,255,0.94)',
    fontSize: FontSize.body - 1,
    lineHeight: 22,
  },
  upcomingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  upcomingTime: {
    color: Colors.light.surfaceRaised,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    marginRight: 4,
  },
  joinButton: {
    minWidth: 120,
  },
  planRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  planTitle: {
    color: Colors.light.text,
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  planBody: {
    color: Colors.light.textSecondary,
    fontSize: FontSize.body - 2,
    lineHeight: 21,
  },
  historyBlock: {
    gap: Spacing.two,
  },
  cardStack: {
    gap: Spacing.three,
  },
  historyCard: {
    gap: 10,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  historyTitleBlock: {
    flex: 1,
  },
  historyTitle: {
    color: Colors.light.text,
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  historyCounselor: {
    color: Colors.light.textSecondary,
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  historyDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.surfaceSoft,
  },
  historyDateText: {
    color: Colors.light.text,
    fontSize: FontSize.small + 1,
    fontWeight: FontWeight.bold,
  },
  historyNote: {
    color: Colors.light.textSecondary,
    fontSize: FontSize.body - 2,
    lineHeight: 20,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  historyTime: {
    color: Colors.light.text,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  emptyCardTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  emptyCardText: {
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    lineHeight: 18,
  },
});
