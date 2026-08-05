import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CounselorCard } from '@/components/ui/counselor-card';
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
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { countUnread } from '@/lib/notification-state';
import { supabase } from '@/lib/supabase';
import {
  analyzeJournalMentalState,
  analyzeMood,
  keywordMood,
  warmUpHF,
  MentalStateAnalysis,
} from '@/lib/sentiment';
import { MOODS, moodEmoji } from '@/lib/moods';
import {
  fetchAppointments,
  fetchCounselors,
  insertMoodLog,
  SupabaseAppointment,
  SupabaseCounselor,
} from '@/lib/supabase-db';
import { getCounselorPhoto } from '@/lib/counselor-utils';


const SPECIALTY_FILTERS = [
  'All',
  'Anxiety',
  'Academic Stress',
  'Burnout',
  'Relationships',
  'Personal Growth',
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  return 'Good evening!';
}

export default function HomeScreen() {
  const { userName, avatarUrl } = useMockAuth();
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Mood journal state (preserved) ──
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isManuallySelected, setIsManuallySelected] = useState(false);
  const [moodNote, setMoodNote] = useState('');
  const [savingMood, setSavingMood] = useState(false);
  const hfDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id so a slow HF response for older text can never overwrite the
  // prediction for what the user has since typed.
  const predictionSeqRef = useRef(0);
  const [predictionSource, setPredictionSource] = useState<
    'idle' | 'pending' | 'huggingface' | 'keyword'
  >('idle');
  const [mentalAnalysis, setMentalAnalysis] = useState<MentalStateAnalysis>({
    sentiment: { score: 0, label: 'neutral' },
    detectedPatterns: {
      anxiety: false,
      burnout: false,
      depression: false,
      crisis: false,
    },
    primaryState: 'normal',
  });
  const [hasOpenedCrisisSheet, setHasOpenedCrisisSheet] = useState(false);
  const [isCrisisModalVisible, setIsCrisisModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'coping' | 'helplines' | 'chat'>(
    'coping'
  );

  // Breathing timer (preserved)
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathingStep, setBreathingStep] = useState<
    'idle' | 'inhale' | 'hold' | 'exhale'
  >('idle');
  const [breathingTimer, setBreathingTimer] = useState(0);

  useEffect(() => {
    if (isCrisisModalVisible) {
      if (
        mentalAnalysis.primaryState === 'crisis' ||
        mentalAnalysis.primaryState === 'depression'
      ) {
        setActiveTab('helplines');
      } else {
        setActiveTab('coping');
      }
    } else {
      setIsBreathingActive(false);
    }
  }, [isCrisisModalVisible, mentalAnalysis.primaryState]);

  useEffect(() => {
    let interval: any = null;
    if (isBreathingActive) {
      let currentStep: 'inhale' | 'hold' | 'exhale' = 'inhale';
      let secondsLeft = 4;
      setBreathingStep('inhale');
      setBreathingTimer(4);
      interval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
          if (currentStep === 'inhale') {
            currentStep = 'hold';
            secondsLeft = 7;
          } else if (currentStep === 'hold') {
            currentStep = 'exhale';
            secondsLeft = 8;
          } else {
            currentStep = 'inhale';
            secondsLeft = 4;
          }
          setBreathingStep(currentStep);
        }
        setBreathingTimer(secondsLeft);
      }, 1000);
    } else {
      setBreathingStep('idle');
      setBreathingTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBreathingActive]);

  const handleJournalChange = (text: string) => {
    setMoodNote(text);
    const analysis = analyzeJournalMentalState(text);
    setMentalAnalysis(analysis);

    const trimmed = text.trim();
    const seq = ++predictionSeqRef.current;

    // Immediate: offline lexicon prediction so the row responds to every
    // keystroke. This is a placeholder — the ML result replaces it below.
    if (trimmed.length > 2) {
      if (!isManuallySelected) {
        setSelectedMood(moodEmoji(keywordMood(trimmed).mood));
        setPredictionSource('pending');
      }
    } else {
      if (!isManuallySelected) {
        setSelectedMood(null);
        setPredictionSource('idle');
      }
    }

    // Debounced: the emotion model decides the final emoji. Unlike the previous
    // version this also records when the ML path was unavailable, so a keyword
    // guess is never presented as an ML prediction.
    if (hfDebounceRef.current) clearTimeout(hfDebounceRef.current);
    if (trimmed.length > 3 && !isManuallySelected) {
      hfDebounceRef.current = setTimeout(async () => {
        try {
          const result = await analyzeMood(trimmed);
          // Stale guard: newer text, a manual emoji tap, or a save has since
          // bumped the sequence, so this prediction is no longer wanted.
          if (seq !== predictionSeqRef.current) return;
          setSelectedMood(moodEmoji(result.mood));
          setPredictionSource(result.source);
        } catch {
          if (seq === predictionSeqRef.current) setPredictionSource('keyword');
        }
      }, 700);
    }

    if (analysis.detectedPatterns.crisis && !hasOpenedCrisisSheet) {
      setIsCrisisModalVisible(true);
      setHasOpenedCrisisSheet(true);
    } else if (!analysis.detectedPatterns.crisis) {
      setHasOpenedCrisisSheet(false);
    }
  };

  // Load the emotion model ahead of the first keystroke so its cold start does
  // not land on the user's first prediction.
  useEffect(() => {
    warmUpHF();
  }, []);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (hfDebounceRef.current) clearTimeout(hfDebounceRef.current);
    };
  }, []);

  const getCircleSize = () => {
    if (breathingStep === 'inhale') return 140;
    if (breathingStep === 'hold') return 160;
    if (breathingStep === 'exhale') return 100;
    return 110;
  };

  const getCircleColor = () => {
    if (breathingStep === 'inhale') return theme.primary;
    if (breathingStep === 'hold') return theme.teal;
    if (breathingStep === 'exhale') return theme.amber;
    return theme.surfaceMuted;
  };

  // ── Dashboard data ──
  const [appointments, setAppointments] = useState<SupabaseAppointment[]>([]);
  const [counselors, setCounselors] = useState<SupabaseCounselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [unreadCount, setUnreadCount] = useState(0);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const fetchUnreadCount = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, is_read')
        .or(`user_id.is.null,user_id.eq.${currentUserId}`);

      if (!error && data) {
        setUnreadCount(await countUnread(data, currentUserId));
      }
    } catch (err) {
      console.warn('Error fetching unread count:', err);
    }
  };

  const loadDashboardData = async () => {
    try {
      const appts = await fetchAppointments(currentUserId, 'student');
      setAppointments(appts);
      const list = await fetchCounselors();
      setCounselors(list);
      await fetchUnreadCount();
    } catch (err) {
      console.warn('Dashboard sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time notification badge updates
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const channelName = `home-notifications-${currentUserId || 'guest'}-${Date.now()}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notif = payload.new as { user_id: string | null };
          // Only increment for broadcasts or notifications targeted at this user
          if (!notif.user_id || notif.user_id === currentUserId) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleLogMood = async () => {
    if (!selectedMood) {
      Alert.alert(
        'Select Mood',
        'Please type in the journal or tap a mood emoji before saving.'
      );
      return;
    }
    setSavingMood(true);
    try {
      const noteText = moodNote.trim();
      // Reuse this result for the DB row instead of letting insertMoodLog run
      // a second round trip against the same text.
      const result = await analyzeMood(noteText);
      const sentiment = result.sentiment;
      await insertMoodLog(currentUserId, selectedMood, noteText, sentiment);
      setMoodNote('');
      setSelectedMood(null);
      setIsManuallySelected(false);
      setPredictionSource('idle');
      predictionSeqRef.current++;
      setMentalAnalysis({
        sentiment: { score: 0, label: 'neutral' },
        detectedPatterns: {
          anxiety: false,
          burnout: false,
          depression: false,
          crisis: false,
        },
        primaryState: 'normal',
      });
      setHasOpenedCrisisSheet(false);
      if (sentiment.isFlagged) {
        Alert.alert(
          'We are here for you',
          'Thank you for checking in. Your safety matters. Please remember that KNUST 24/7 counseling line is always available at 03220-60352. You are not alone.'
        );
      } else if (sentiment.label === 'negative') {
        Alert.alert(
          'Mood Logged',
          'Thank you for sharing. Remember to take it easy today. Academic pressure is tough, but you are doing your best.'
        );
      } else {
        Alert.alert(
          'Mood Saved',
          'Your daily mood check-in has been logged successfully. Keep shining!'
        );
      }
    } catch (e) {
      console.warn('Mood save failed:', e);
      Alert.alert('Offline Logging', 'Could not save mood log right now.');
    } finally {
      setSavingMood(false);
    }
  };

  const upcomingSessions = appointments.filter((a) =>
    ['pending', 'accepted'].includes(a.status)
  );
  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

  // Filter counselors by search + specialty
  const filteredCounselors = counselors.filter((c) => {
    const name = c.profile?.name || '';
    const spec = c.specialties.join(' ');
    const matchesSearch =
      !searchQuery ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spec.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === 'All' ||
      c.specialties.some((s) =>
        s.toLowerCase().includes(activeFilter.toLowerCase())
      );
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + 128,
          },
        ]}>
        <View style={styles.container}>
          {/* ── Header: Avatar + Greeting + Bell ── */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrap}>
                <Avatar
                  name={userName}
                  source={avatarUrl ? { uri: avatarUrl } : undefined}
                  size="md"
                />
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: theme.success, borderColor: theme.background },
                  ]}
                />
              </View>
              <View style={styles.greetingBlock}>
                <Text
                  style={[
                    styles.greetingText,
                    { color: theme.textSecondary },
                  ]}>
                  {getGreeting()}
                </Text>
                <Text style={[styles.title, { color: theme.text }]}>
                  {userName.split(' ')[0] || 'Student'}
                </Text>
              </View>
            </View>
              <Pressable
              style={[
                styles.bellButton,
                {
                  backgroundColor: theme.surfaceRaised,
                },
              ]}
              onPress={() => router.push('/notifications')}>
              <Badge
                count={unreadCount}
                size={19}
                max={9}
                color={theme.error}
                style={{
                  width: 19,
                  height: 19,
                  minWidth: 19,
                  borderRadius: 9.5,
                  paddingHorizontal: 0,
                  top: -2,
                  right: -2,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={22}
                  color={theme.text}
                />
              </Badge>
            </Pressable>
          </View>

          {/* ── Headline ── */}
          <Text style={[styles.headline, { color: theme.text }]}>
            How are you feeling today?
          </Text>


          {/* ── Mood Journal Card ── */}
          <Card
            variant="raised"
            padding="three"
            style={styles.moodCard}>
            <View style={styles.moodHeaderRow}>
              <Text style={[styles.moodHeader, { color: theme.text }]}>
                Daily Wellbeing Journal
              </Text>
              {moodNote.trim().length > 2 && !isManuallySelected && (
                <Text
                  style={[
                    styles.predictedBadge,
                    predictionSource === 'keyword'
                      ? { color: theme.textSecondary, backgroundColor: theme.surfaceSoft }
                      : { color: theme.primary, backgroundColor: theme.primarySoft },
                  ]}>
                  {predictionSource === 'huggingface'
                    ? 'AI Suggested'
                    : predictionSource === 'keyword'
                      ? 'Offline Guess'
                      : 'Analyzing...'}
                </Text>
              )}
            </View>

            <View
              style={[
                styles.noteInputWrapper,
                {
                  backgroundColor: theme.surfaceSoft,
                },
              ]}>
              <TextInput
                placeholder="Write your journal entry here..."
                placeholderTextColor={theme.textSecondary}
                value={moodNote}
                onChangeText={handleJournalChange}
                multiline
                numberOfLines={3}
                style={[
                  styles.noteInput,
                  { color: theme.text, textAlignVertical: 'top' },
                ]}
              />
            </View>

            <View style={styles.emojiRow}>
              {MOODS.map((m) => {
                const isSelected = selectedMood === m.emoji;
                return (
                  <Pressable
                    key={m.emoji}
                    onPress={() => {
                      setSelectedMood(m.emoji);
                      setIsManuallySelected(true);
                      // Cancel any in-flight prediction so it cannot overwrite
                      // the mood the user just picked.
                      if (hfDebounceRef.current) clearTimeout(hfDebounceRef.current);
                      predictionSeqRef.current++;
                    }}
                    style={[
                      styles.emojiButton,
                      isSelected && {
                        backgroundColor: theme.primarySoft,
                      },
                      !isSelected && {
                        backgroundColor: theme.surfaceSoft,
                      },
                    ]}>
                    <Text style={styles.emojiText}>{m.emoji}</Text>
                    <Text
                      style={[
                        styles.emojiLabel,
                        { color: theme.textSecondary },
                        isSelected && {
                          color: theme.primary,
                          fontWeight: FontWeight.bold,
                        },
                      ]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Real-time Alert Banner */}
            {mentalAnalysis.primaryState !== 'normal' && (
              <Pressable
                onPress={() => setIsCrisisModalVisible(true)}
                style={[
                  styles.alertContainer,
                  mentalAnalysis.primaryState === 'crisis' ||
                  mentalAnalysis.primaryState === 'depression'
                    ? {
                        backgroundColor: theme.errorSoft,
                      }
                    : mentalAnalysis.primaryState === 'anxiety'
                      ? {
                          backgroundColor: theme.warningSoft,
                        }
                      : {
                          backgroundColor: theme.primaryMuted,
                        },
                ]}>
                <MaterialCommunityIcons
                  name={
                    mentalAnalysis.primaryState === 'crisis' ||
                    mentalAnalysis.primaryState === 'depression'
                      ? 'alert-octagon'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? 'alert-decagram'
                        : 'book-open-page-variant'
                  }
                  size={20}
                  color={
                    mentalAnalysis.primaryState === 'crisis' ||
                    mentalAnalysis.primaryState === 'depression'
                      ? theme.error
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? theme.warning
                        : theme.primary
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.alertTextTitle,
                      {
                        color:
                          mentalAnalysis.primaryState === 'crisis' ||
                          mentalAnalysis.primaryState === 'depression'
                            ? theme.error
                            : mentalAnalysis.primaryState === 'anxiety'
                              ? theme.warning
                              : theme.text,
                      },
                    ]}>
                    {mentalAnalysis.primaryState === 'crisis' ||
                    mentalAnalysis.primaryState === 'depression'
                      ? 'Immediate Support Suggested'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? 'Anxiety Patterns Detected'
                        : 'Academic Stress Detected'}
                  </Text>
                  <Text
                    style={[
                      styles.alertTextBody,
                      { color: theme.textSecondary },
                    ]}>
                    {mentalAnalysis.primaryState === 'crisis' ||
                    mentalAnalysis.primaryState === 'depression'
                      ? 'We care about your safety. Tap to view crisis lines.'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? 'Feeling overwhelmed? Tap for a calming exercise.'
                        : 'Exam strain? Tap for coping tips.'}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            )}

            <Button
              label={savingMood ? 'Saving...' : 'Save Daily Log'}
              variant="primary"
              onPress={handleLogMood}
              disabled={savingMood || !moodNote.trim()}
              style={styles.moodSubmitBtn}
            />
          </Card>

          {/* ── Upcoming Session (solid purple card) ── */}
          {nextSession && (
            <>
              <SectionHeader
                title="Upcoming Session"
                actionLabel="View all"
                onActionPress={() => router.push('/(tabs)/sessions')}
              />
              <Pressable
                onPress={() => router.push('/(tabs)/sessions')}
                style={({ pressed }) => [
                  styles.upcomingCard,
                  {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                  isDark ? Shadows.dark.card : Shadows.light.card,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.upcomingTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingLabel}>
                      {nextSession.counselor_profile?.name || 'Counselor'}
                    </Text>
                    <Text style={styles.upcomingSpecialty}>
                      {nextSession.topic || 'Mental Wellbeing Consultation'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/video-call',
                        params: {
                          counselorName:
                            nextSession.counselor_profile?.name || 'Counselor',
                          counselorId: nextSession.counselor_id,
                          callType: 'video',
                        },
                      })
                    }
                    style={styles.videoCallBtn}>
                    <MaterialCommunityIcons
                      name="video"
                      size={20}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>

                <View style={styles.upcomingDetailsRow}>
                  <View style={styles.upcomingDetailItem}>
                    <MaterialCommunityIcons
                      name="calendar-outline"
                      size={14}
                      color="rgba(255,255,255,0.8)"
                    />
                    <Text style={styles.upcomingDetailText}>
                      {new Date(
                        nextSession.appointment_date
                      ).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.upcomingDetailItem}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={14}
                      color="rgba(255,255,255,0.8)"
                    />
                    <Text style={styles.upcomingDetailText}>
                      {nextSession.time_slot}
                    </Text>
                  </View>
                </View>

                <View style={styles.upcomingActions}>
                  <Pressable
                    style={styles.upcomingActionBtn}
                    onPress={() => router.push('/(tabs)/sessions')}>
                    <Text style={styles.upcomingActionText}>Reschedule</Text>
                  </Pressable>
                  <View style={styles.upcomingActionDivider} />
                  <Pressable
                    style={styles.upcomingActionBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/counselor/[id]',
                        params: { id: nextSession.counselor_id },
                      })
                    }>
                    <Text style={styles.upcomingActionText}>
                      View Profile
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </>
          )}

          {loading ? (
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={{ marginVertical: Spacing.four }}
            />
          ) : (
            <>
              {/* ── Recommended Counselors ── */}
              <SectionHeader
                title="Recommended Counselors"
                actionLabel="See all"
                onActionPress={() => router.push('/(tabs)/sessions')}
              />

              {/* Filter pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}>
                {SPECIALTY_FILTERS.map((filter) => (
                  <Pressable
                    key={filter}
                    onPress={() => setActiveFilter(filter)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor:
                          activeFilter === filter
                            ? theme.primary
                            : theme.surfaceSoft,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.filterPillText,
                        {
                          color:
                            activeFilter === filter
                              ? theme.textInverse
                              : theme.textSecondary,
                        },
                      ]}>
                      {filter}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Counselor cards (horizontal list) */}
              {filteredCounselors.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.counselorListContent}>
                  {filteredCounselors.slice(0, 6).map((item) => {
                    const cName = item.profile?.name || 'Counselor';
                    const cSpec = item.specialties[0] || 'Peer Connection';
                    const cPhoto = getCounselorPhoto(
                      cName,
                      item.profile?.avatar_url
                    );
                    return (
                      <CounselorCard
                        key={item.id}
                        id={item.id}
                        name={cName}
                        specialty={cSpec}
                        photoUrl={cPhoto}
                        rating={item.rating}
                        variant="vertical"
                      />
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={{ color: theme.textSecondary }}>
                    No counselors match your search.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ── FAB for Social timeline ── */}
      <Pressable
        style={[
          styles.fab,
          { backgroundColor: theme.primary },
        ]}
        onPress={() => router.push('/social-feed')}>
        <MaterialCommunityIcons name="earth" size={26} color="#FFFFFF" />
      </Pressable>

      {/* ═══════════════════════════════════════════════
         Crisis & Support Intervention Sheet (preserved)
         ═══════════════════════════════════════════════ */}
      <Modal
        animationType="slide"
        transparent
        visible={isCrisisModalVisible}
        onRequestClose={() => setIsCrisisModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.surfaceRaised,
              },
            ]}>
            <View style={[styles.modalDragIndicator, { backgroundColor: theme.divider }]} />

            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <MaterialCommunityIcons
                  name={
                    mentalAnalysis.primaryState === 'crisis' ||
                    mentalAnalysis.primaryState === 'depression'
                      ? 'alert-octagon'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? 'alert-decagram'
                        : 'book-open-page-variant'
                  }
                  size={24}
                  color={
                    mentalAnalysis.primaryState === 'crisis' ||
                    mentalAnalysis.primaryState === 'depression'
                      ? theme.error
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? theme.warning
                        : theme.primary
                  }
                />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {mentalAnalysis.primaryState === 'crisis' ||
                  mentalAnalysis.primaryState === 'depression'
                    ? 'Crisis & Wellbeing Support'
                    : mentalAnalysis.primaryState === 'anxiety'
                      ? 'Grounding & Anxiety Relief'
                      : 'Academic Stress Guidance'}
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setIsCrisisModalVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>

            <Text
              style={[
                styles.modalSubtitle,
                { color: theme.textSecondary },
              ]}>
              {mentalAnalysis.primaryState === 'crisis' ||
              mentalAnalysis.primaryState === 'depression'
                ? "Your safety and wellbeing are paramount. Please use the resources below."
                : mentalAnalysis.primaryState === 'anxiety'
                  ? 'If your mind is racing, take a few minutes to reset.'
                  : 'KNUST study loads can get heavy. Here are ways to manage.'}
            </Text>

            {/* Modal tabs */}
            <View
              style={[
                styles.tabBar,
                { backgroundColor: theme.surfaceSoft },
              ]}>
              {(
                [
                  { key: 'coping', icon: 'spa-outline', label: 'Coping Tool' },
                  { key: 'helplines', icon: 'phone-outline', label: 'Helplines' },
                  { key: 'chat', icon: 'message-text-outline', label: 'Counselors' },
                ] as const
              ).map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    setActiveTab(tab.key);
                    setIsBreathingActive(false);
                  }}
                  style={[
                    styles.tabButton,
                    activeTab === tab.key && {
                      backgroundColor: theme.surfaceRaised,
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name={tab.icon}
                    size={16}
                    color={
                      activeTab === tab.key
                        ? theme.primary
                        : theme.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          activeTab === tab.key
                            ? theme.text
                            : theme.textSecondary,
                      },
                    ]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.tabContentContainer}>
              {activeTab === 'coping' && (
                <ScrollView
                  contentContainerStyle={styles.tabScrollContent}
                  showsVerticalScrollIndicator={false}>
                  {mentalAnalysis.primaryState === 'burnout' ? (
                    <View style={styles.burnoutSection}>
                      <Text
                        style={[
                          styles.sectionHeading,
                          { color: theme.text },
                        ]}>
                        Coping with Academic Burnout
                      </Text>
                      {[
                        {
                          icon: 'clock-check-outline',
                          title: '1. Structured Rest Breaks',
                          body: 'Study for 45 minutes, then take a 10-minute break away from screens.',
                        },
                        {
                          icon: 'calendar-alert',
                          title: '2. Workload Triaging',
                          body: 'List assignments by deadline. Focus on the top item today.',
                        },
                        {
                          icon: 'pill',
                          title: '3. Physical Recovery',
                          body: 'Prioritize 7-8 hours of sleep. Neural paths reload during slow-wave sleep.',
                        },
                      ].map((item, i) => (
                        <View
                          key={i}
                          style={[
                            styles.adviceCard,
                            { backgroundColor: theme.surfaceSoft },
                          ]}>
                          <MaterialCommunityIcons
                            name={item.icon as any}
                            size={20}
                            color={theme.primary}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.adviceTitle,
                                { color: theme.text },
                              ]}>
                              {item.title}
                            </Text>
                            <Text
                              style={[
                                styles.adviceBody,
                                { color: theme.textSecondary },
                              ]}>
                              {item.body}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.breathingSection}>
                      <Text
                        style={[
                          styles.sectionHeading,
                          { color: theme.text, textAlign: 'center' },
                        ]}>
                        4-7-8 Deep Breathing Exercise
                      </Text>
                      <Text
                        style={[
                          styles.sectionSubheading,
                          { color: theme.textSecondary, textAlign: 'center' },
                        ]}>
                        Inhale for 4 seconds, hold for 7, exhale for 8.
                      </Text>
                      <View style={styles.breathingContainer}>
                        <View
                          style={[
                            styles.breathingCircle,
                            {
                              width: getCircleSize(),
                              height: getCircleSize(),
                              borderRadius: getCircleSize() / 2,
                              backgroundColor: getCircleColor(),
                            },
                          ]}>
                          {isBreathingActive ? (
                            <View style={styles.breathingLabelWrapper}>
                              <Text style={styles.breathingStepText}>
                                {breathingStep === 'inhale'
                                  ? 'Inhale'
                                  : breathingStep === 'hold'
                                    ? 'Hold'
                                    : 'Exhale'}
                              </Text>
                              <Text style={styles.breathingTimerText}>
                                {breathingTimer}s
                              </Text>
                            </View>
                          ) : (
                            <MaterialCommunityIcons
                              name="spa"
                              size={36}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                      </View>
                      <Button
                        label={
                          isBreathingActive
                            ? 'Stop Exercise'
                            : 'Start Breathing Exercise'
                        }
                        variant={isBreathingActive ? 'secondary' : 'primary'}
                        onPress={() =>
                          setIsBreathingActive(!isBreathingActive)
                        }
                        style={styles.breathingButton}
                      />
                    </View>
                  )}
                </ScrollView>
              )}

              {activeTab === 'helplines' && (
                <View style={styles.helplineSection}>
                  <Text
                    style={[
                      styles.sectionHeading,
                      { color: theme.text },
                    ]}>
                    Immediate Crisis Contact
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubheading,
                      { color: theme.textSecondary },
                    ]}>
                    Free, confidential mental health support.
                  </Text>
                  <View style={styles.phoneList}>
                    {[
                      {
                        name: 'KNUST Counseling Hotline (24/7)',
                        number: '03220-60352',
                        url: 'tel:0322060352',
                      },
                      {
                        name: 'Ghana Mental Health Helpline',
                        number: '+233 59 666 4444',
                        url: 'tel:+233596664444',
                      },
                    ].map((line, i) => (
                      <Pressable
                        key={i}
                        onPress={() => Linking.openURL(line.url)}
                        style={[
                          styles.phoneButton,
                          {
                            backgroundColor: theme.surfaceSoft,
                          },
                        ]}>
                        <View
                          style={[
                            styles.phoneIconBg,
                            {
                              backgroundColor: theme.errorSoft,
                            },
                          ]}>
                          <MaterialCommunityIcons
                            name="phone"
                            size={20}
                            color={theme.error}
                          />
                        </View>
                        <View style={styles.phoneTextContainer}>
                          <Text
                            style={[
                              styles.phoneLabel,
                              { color: theme.text },
                            ]}
                            numberOfLines={1}>
                            {line.name}
                          </Text>
                          <Text
                            style={[
                              styles.phoneNumber,
                              { color: theme.primary },
                            ]}>
                            {line.number}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={20}
                          color={theme.textSecondary}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {activeTab === 'chat' && (
                <View style={styles.chatSection}>
                  <Text
                    style={[
                      styles.sectionHeading,
                      { color: theme.text },
                    ]}>
                    Connect with Professional Support
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubheading,
                      { color: theme.textSecondary },
                    ]}>
                    Reach out to a peer counselor or schedule a session.
                  </Text>
                  <View style={styles.actionButtonsRow}>
                    <Button
                      label="Open Chats"
                      icon="message-text"
                      onPress={() => {
                        setIsCrisisModalVisible(false);
                        router.push('/(tabs)/chats');
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Book Session"
                      icon="calendar"
                      variant="secondary"
                      onPress={() => {
                        setIsCrisisModalVisible(false);
                        router.push('/(tabs)/sessions');
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <Button
                label="Dismiss Check-in"
                variant="secondary"
                onPress={() => setIsCrisisModalVisible(false)}
                style={styles.modalDismissBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  pressed: { opacity: 0.85 },

  /* ── Header ── */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarWrap: { position: 'relative', marginTop: 2 },
  statusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  greetingBlock: { gap: 2 },
  greetingText: { fontSize: FontSize.body - 2, lineHeight: 20 },
  title: {
    fontSize: FontSize.h1,
    lineHeight: 34,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.6,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Headline ── */
  headline: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },

  /* ── Search ── */
  searchBarContainer: { marginTop: 0 },

  /* ── Mood Card ── */
  moodCard: {
    gap: Spacing.two,
    borderRadius: BorderRadius.sm,
  },
  moodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moodHeader: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  predictedBadge: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  noteInputWrapper: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  noteInput: {
    fontSize: FontSize.body - 3,
    minHeight: 60,
    paddingVertical: 0,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one - 2,
  },
  emojiButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: Spacing.two - 2,
    paddingHorizontal: 2,
    borderRadius: BorderRadius.md,
    gap: 2,
  },
  emojiText: { fontSize: 20 },
  // Six columns leaves ~50px per label, so the longest ("Distressed") wraps.
  // Centering keeps the wrapped line aligned under its emoji.
  emojiLabel: { fontSize: FontSize.small - 3, textAlign: 'center' },
  moodSubmitBtn: {
    height: Size.buttonHeight - 8,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.one,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.two + 4,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.one,
  },
  alertTextTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  alertTextBody: {
    fontSize: FontSize.small,
    marginTop: 1,
    lineHeight: 15,
  },

  /* ── Upcoming Session Card ── */
  upcomingCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  upcomingLabel: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  upcomingSpecialty: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  videoCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingDetailsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  upcomingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upcomingDetailText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  upcomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: Spacing.two,
  },
  upcomingActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  upcomingActionText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  upcomingActionDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  /* ── Filter pills ── */
  filterRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  filterPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 2,
    borderRadius: BorderRadius.full,
  },
  filterPillText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },

  /* ── Counselor list ── */
  counselorListContent: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },

  /* ── FAB ── */
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

  /* ── Crisis modal (preserved) ── */
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.four,
    maxHeight: '90%',
    gap: Spacing.three,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold },
  modalCloseButton: { padding: Spacing.one },
  modalSubtitle: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
    marginBottom: Spacing.two,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two + 4,
    borderRadius: BorderRadius.sm,
  },
  tabText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  tabContentContainer: { minHeight: 280 },
  tabScrollContent: { paddingVertical: Spacing.two },
  burnoutSection: { gap: Spacing.two + 2 },
  sectionHeading: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.one,
  },
  sectionSubheading: {
    fontSize: FontSize.caption,
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  adviceCard: {
    flexDirection: 'row',
    gap: 12,
    padding: Spacing.three,
    borderRadius: BorderRadius.sm,
  },
  adviceTitle: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
    marginBottom: 2,
  },
  adviceBody: {
    fontSize: FontSize.caption,
    lineHeight: 16,
  },
  breathingSection: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  breathingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breathingCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
  },
  breathingLabelWrapper: {
    alignItems: 'center',
    gap: 2,
  },
  breathingStepText: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  breathingTimerText: {
    color: '#FFFFFF',
    fontSize: FontSize.h1,
    fontWeight: FontWeight.bold,
  },
  breathingButton: {
    width: '100%',
    marginTop: Spacing.two,
  },
  helplineSection: { paddingVertical: Spacing.two },
  phoneList: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  phoneTextContainer: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },
  phoneIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneLabel: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.semibold,
  },
  phoneNumber: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  chatSection: {
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  modalFooter: { marginTop: Spacing.two },
  modalDismissBtn: { width: '100%' },
});
