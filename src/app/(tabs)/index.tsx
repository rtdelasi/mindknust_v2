import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card, SectionHeader } from '@/components/ui';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  MaxContentWidth,
  Shadows,
  Size,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import {
  fetchAppointments,
  fetchCounselors,
  fetchUserChats,
  insertMoodLog,
  SupabaseAppointment,
  SupabaseCounselor
} from '@/lib/supabase-db';
import { getCounselorPhoto } from './sessions';
import { analyzeSentiment } from '@/lib/sentiment';

const moods = [
  { emoji: '😢', label: 'Sad' },
  { emoji: '😕', label: 'Meh' },
  { emoji: '🙂', label: 'Okay' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😁', label: 'Great' },
];

export default function HomeScreen() {
  const { userName } = useMockAuth();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedMood, setSelectedMood] = useState('🙂');
  const [moodNote, setMoodNote] = useState('');
  const [savingMood, setSavingMood] = useState(false);

  const [appointments, setAppointments] = useState<SupabaseAppointment[]>([]);
  const [counselors, setCounselors] = useState<SupabaseCounselor[]>([]);
  const [activeChatsCount, setActiveChatsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const loadDashboardData = async () => {
    try {
      const appts = await fetchAppointments(currentUserId, 'student');
      setAppointments(appts);

      const list = await fetchCounselors();
      setCounselors(list);

      const chats = await fetchUserChats(currentUserId, 'student');
      setActiveChatsCount(chats.length);
    } catch (err) {
      console.warn('Dashboard sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleLogMood = async () => {
    setSavingMood(true);
    try {
      const noteText = moodNote.trim();
      
      // Analyze sentiment (HF API → keyword fallback)
      const sentiment = await analyzeSentiment(noteText);

      await insertMoodLog(currentUserId, selectedMood, noteText);
      setMoodNote('');

      if (sentiment.isFlagged) {
        Alert.alert(
          'We are here for you',
          'Thank you for checking in. Your safety matters. Please remember that KNUST 24/7 counseling line is always available at 03220-60352. You are not alone. 💙'
        );
      } else if (sentiment.label === 'negative') {
        Alert.alert(
          'Mood Logged',
          'Thank you for sharing. Remember to take it easy today. Academic pressure is tough, but you are doing your best. 💙'
        );
      } else {
        Alert.alert(
          'Mood Saved',
          'Your daily mood check-in has been logged successfully. Keep shining! 🌟'
        );
      }
    } catch (e) {
      console.warn('Mood save failed:', e);
      Alert.alert('Offline Logging', 'Could not save mood log right now.');
    } finally {
      setSavingMood(false);
    }
  };

  // Determine next active upcoming session
  const upcomingSessions = appointments.filter(a => ['pending', 'accepted'].includes(a.status));
  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 128 },
        ]}>
        <View style={styles.container}>
          {/* Header section */}
          <View style={styles.headerRow}>
            <View style={styles.greetingBlock}>
              <View style={[styles.eyebrowWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Text style={[styles.eyebrow, { color: theme.primary }]}>CounselCare</Text>
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Hello, {userName.split(' ')[0] || 'User'}.</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Book a counselor, join a session, or check your wellbeing plan.
              </Text>
            </View>
            <Pressable style={[styles.bellButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]} onPress={() => router.push('/notifications')}>
              <MaterialCommunityIcons name="bell-outline" size={Size.iconMd + 2} color={theme.text} />
            </Pressable>
          </View>

          {/* Mood Log Check-in card */}
          <Card variant="raised" padding="four" style={styles.moodCard}>
            <Text style={[styles.moodHeader, { color: theme.text }]}>How are you feeling today?</Text>
            <View style={styles.emojiRow}>
              {moods.map((m) => {
                const isSelected = selectedMood === m.emoji;
                return (
                  <Pressable
                    key={m.emoji}
                    onPress={() => setSelectedMood(m.emoji)}
                    style={[
                      styles.emojiButton,
                      { borderColor: theme.border },
                      isSelected && { backgroundColor: theme.primarySoft, borderColor: theme.primary }
                    ]}>
                    <Text style={styles.emojiText}>{m.emoji}</Text>
                    <Text style={[styles.emojiLabel, { color: theme.textSecondary }, isSelected && { color: theme.primary, fontWeight: FontWeight.bold }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.noteInputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
              <TextInput
                placeholder="What is making you feel this way? (optional)"
                placeholderTextColor={theme.textSecondary}
                value={moodNote}
                onChangeText={setMoodNote}
                style={[styles.noteInput, { color: theme.text }]}
              />
            </View>

            <Button
              label={savingMood ? "Saving..." : "Save Log"}
              variant="primary"
              onPress={handleLogMood}
              disabled={savingMood}
              style={styles.moodSubmitBtn}
            />
          </Card>

          {/* Real-time statistics metrics */}
          <View style={styles.statRow}>
            <MetricCard
              icon="calendar-clock"
              label="Next session"
              value={nextSession ? `${nextSession.time_slot}` : "None Booked"}
            />
            <MetricCard
              icon="message-text-outline"
              label="Active Chats"
              value={`${activeChatsCount} channels`}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: Spacing.four }} />
          ) : (
            <>
              {/* Dynamic Next Session Card */}
              {nextSession && (
                <>
                  <SectionHeader title="Upcoming session" actionLabel="View all" onActionPress={() => router.push('/(tabs)/sessions')} />
                  <Card variant="raised" padding="four" style={styles.upcomingCard}>
                    <View style={styles.upcomingTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.upcomingLabel}>Upcoming Session</Text>
                        <Text style={styles.upcomingCounselor}>
                          {nextSession.counselor_profile?.name || 'Counselor'} - Student Counselor
                        </Text>
                      </View>
                      <View style={styles.datePill}>
                        <MaterialCommunityIcons name="video" size={Size.iconSm} color={Colors.light.surfaceRaised} />
                        <Text style={styles.datePillText}>
                          {new Date(nextSession.appointment_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.upcomingNote}>Topic: {nextSession.topic || 'Mental Wellbeing Consultation'}</Text>

                    <View style={styles.upcomingFooter}>
                      <View style={styles.timeRow}>
                        <MaterialCommunityIcons name="clock-outline" size={Size.iconSm + 2} color={Colors.light.surfaceRaised} />
                        <Text style={styles.upcomingTime}>{nextSession.time_slot}</Text>
                      </View>

                      <Button
                        label="Join call"
                        onPress={() => router.push('/video-call')}
                        variant="secondary"
                        style={styles.joinButton}
                      />
                    </View>
                  </Card>
                </>
              )}

              {/* Dynamic Recommended Counselors */}
              <SectionHeader title="Recommended counselors" actionLabel="See all" onActionPress={() => router.push('/(tabs)/sessions')} />
              <View style={styles.counselorList}>
                {counselors.slice(0, 3).map((c) => {
                  const cName = c.profile?.name || 'Counselor';
                  const cSpec = c.specialties[0] || 'Peer Connection';
                  const cPhoto = getCounselorPhoto(cName, c.profile?.avatar_url);

                  return (
                    <Card key={c.id} variant="raised" padding="three" style={styles.counselorCard}>
                      <View style={styles.counselorTopRow}>
                        <Avatar name={cName} size="md" source={{ uri: cPhoto }} />
                        <View style={styles.counselorContent}>
                          <Text style={[styles.counselorName, { color: theme.text }]}>{cName}</Text>
                          <Text style={[styles.counselorSpecialty, { color: theme.primary }]}>{cSpec}</Text>
                          <Text style={[styles.counselorNote, { color: theme.textSecondary }]} numberOfLines={1}>
                            {c.bio || 'KNUST wellness support advisor.'}
                          </Text>
                        </View>
                        <View style={styles.counselorMeta}>
                          <View style={[styles.ratingPill, { backgroundColor: theme.surfaceMuted }]}>
                            <MaterialCommunityIcons name="star" size={14} color="#FFB000" />
                            <Text style={[styles.ratingText, { color: theme.text }]}>{c.rating || '5.0'}</Text>
                          </View>
                          <Button
                            label="Profile"
                            variant="secondary"
                            style={styles.bookBtn}
                            onPress={() =>
                              router.push({
                                pathname: '/counselor/[id]',
                                params: { id: c.id }
                              })
                            }
                          />
                        </View>
                      </View>
                    </Card>
                  );
                })}

                {counselors.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={{ color: theme.textSecondary }}>No counselors currently active.</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button (FAB) for Social timeline */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            ...Shadows.light.floating,
          },
        ]}
        onPress={() => router.push('/social-feed')}>
        <MaterialCommunityIcons name="earth" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <Card variant="surface" padding="three" style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={Size.iconMd} color={theme.primary} />
      </View>
      <View style={styles.metricTextBlock}>
        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  greetingBlock: {
    flex: 1,
    gap: 4,
  },
  eyebrowWrap: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.half,
    borderWidth: 1,
  },
  eyebrow: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: FontSize.h1,
    lineHeight: 34,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: FontSize.body - 2,
    lineHeight: 20,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  moodCard: {
    gap: Spacing.three,
    borderRadius: BorderRadius.md + 4,
  },
  moodHeader: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  emojiButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  emojiText: {
    fontSize: 22,
  },
  emojiLabel: {
    fontSize: FontSize.small - 1,
  },
  noteInputWrapper: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  noteInput: {
    fontSize: FontSize.body - 2,
    paddingVertical: 0,
  },
  moodSubmitBtn: {
    height: Size.buttonHeight - 4,
    borderRadius: BorderRadius.full,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderRadius: BorderRadius.md + 4,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTextBlock: {
    flex: 1,
    gap: 1,
  },
  metricLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  metricValue: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
  },
  upcomingCard: {
    gap: Spacing.three,
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
    borderRadius: BorderRadius.md + 4,
    ...Shadows.light.raised,
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  upcomingLabel: {
    color: Colors.light.surfaceRaised,
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  upcomingCounselor: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: FontSize.body - 2,
    marginTop: 2,
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
    color: 'rgba(255,255,255,0.92)',
    fontSize: FontSize.body - 2,
    lineHeight: 20,
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
  },
  upcomingTime: {
    color: Colors.light.surfaceRaised,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  joinButton: {
    minWidth: 100,
    height: 38,
  },
  counselorList: {
    gap: Spacing.two,
  },
  counselorCard: {
    borderRadius: BorderRadius.md + 4,
  },
  counselorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  counselorContent: {
    flex: 1,
    gap: 2,
  },
  counselorName: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  counselorSpecialty: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  counselorNote: {
    fontSize: FontSize.caption,
  },
  counselorMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  ratingText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  bookBtn: {
    height: 32,
    paddingHorizontal: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.four,
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
