import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { analyzeJournalMentalState, analyzeSentiment, MentalStateAnalysis } from '@/lib/sentiment';
import {
  fetchAppointments,
  fetchCounselors,
  fetchUserChats,
  insertMoodLog,
  SupabaseAppointment,
  SupabaseCounselor
} from '@/lib/supabase-db';
import { getCounselorPhoto } from '@/lib/counselor-utils';

const moods = [
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '🙂', label: 'Okay' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😁', label: 'Great' },
];

export default function HomeScreen() {
  const { userName } = useMockAuth();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isManuallySelected, setIsManuallySelected] = useState(false);
  const [moodNote, setMoodNote] = useState('');
  const [savingMood, setSavingMood] = useState(false);

  const [mentalAnalysis, setMentalAnalysis] = useState<MentalStateAnalysis>({
    sentiment: { score: 0, label: 'neutral' },
    detectedPatterns: { anxiety: false, burnout: false, depression: false, crisis: false },
    primaryState: 'normal',
  });
  const [hasOpenedCrisisSheet, setHasOpenedCrisisSheet] = useState(false);
  const [isCrisisModalVisible, setIsCrisisModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'coping' | 'helplines' | 'chat'>('coping');

  // Breathing timer states
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathingStep, setBreathingStep] = useState<'idle' | 'inhale' | 'hold' | 'exhale'>('idle');
  const [breathingTimer, setBreathingTimer] = useState(0);

  // Sync tab active choice and breathing timer cleanup when modal opens/closes
  useEffect(() => {
    if (isCrisisModalVisible) {
      if (mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression') {
        setActiveTab('helplines');
      } else {
        setActiveTab('coping');
      }
    } else {
      setIsBreathingActive(false);
    }
  }, [isCrisisModalVisible, mentalAnalysis.primaryState]);

  // Stateful breathing timer effect
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

    // Analyze mental state in real time
    const analysis = analyzeJournalMentalState(text);
    setMentalAnalysis(analysis);

    // Auto-predict emoji based on sentiment score if not manually selected
    if (text.trim().length > 2) {
      if (!isManuallySelected) {
        let predictedEmoji = '🙂';
        const score = analysis.sentiment.score;
        if (score < -0.4) {
          predictedEmoji = '😢';
        } else if (score < -0.1) {
          predictedEmoji = '😡';
        } else if (score <= 0.1) {
          predictedEmoji = '🙂';
        } else if (score <= 0.5) {
          predictedEmoji = '😊';
        } else {
          predictedEmoji = '😁';
        }
        setSelectedMood(predictedEmoji);
      }
    } else {
      if (!isManuallySelected) {
        setSelectedMood(null);
      }
    }

    // Auto-trigger Crisis Sheet
    if (analysis.detectedPatterns.crisis && !hasOpenedCrisisSheet) {
      setIsCrisisModalVisible(true);
      setHasOpenedCrisisSheet(true);
    } else if (!analysis.detectedPatterns.crisis) {
      setHasOpenedCrisisSheet(false);
    }
  };

  const getCircleSize = () => {
    if (breathingStep === 'inhale') return 140;
    if (breathingStep === 'hold') return 160;
    if (breathingStep === 'exhale') return 100;
    return 110;
  };

  const getCircleColor = () => {
    if (breathingStep === 'inhale') return '#5B4FE5';
    if (breathingStep === 'hold') return '#3F8C7A';
    if (breathingStep === 'exhale') return '#FF9500';
    return theme.surfaceMuted;
  };



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
    if (!selectedMood) {
      Alert.alert('Select Mood', 'Please type in the journal or tap a mood emoji before saving.');
      return;
    }
    setSavingMood(true);
    try {
      const noteText = moodNote.trim();

      // Analyze sentiment (HF API → keyword fallback)
      const sentiment = await analyzeSentiment(noteText);

      await insertMoodLog(currentUserId, selectedMood, noteText);
      setMoodNote('');
      setSelectedMood(null);
      setIsManuallySelected(false);
      setMentalAnalysis({
        sentiment: { score: 0, label: 'neutral' },
        detectedPatterns: { anxiety: false, burnout: false, depression: false, crisis: false },
        primaryState: 'normal',
      });
      setHasOpenedCrisisSheet(false);

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
            <Text style={[styles.moodHeader, { color: theme.text }]}>Daily Wellbeing Journal</Text>

            <View style={[styles.noteInputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft, minHeight: 120 }]}>
              <TextInput
                placeholder="Write your brief journal entry here... (e.g. how you feel today, your academic stressors, or what's on your mind)"
                placeholderTextColor={theme.textSecondary}
                value={moodNote}
                onChangeText={handleJournalChange}
                multiline={true}
                numberOfLines={5}
                style={[styles.noteInput, { color: theme.text, textAlignVertical: 'top', minHeight: 100 }]}
              />
            </View>

            <View style={styles.emojiSectionHeader}>
              <Text style={[styles.emojiSectionTitle, { color: theme.text }]}>How are you feeling?</Text>
              {moodNote.trim().length > 2 && (
                <Text style={[styles.predictedBadge, { color: theme.primary, backgroundColor: theme.primarySoft }]}>
                  AI Suggested
                </Text>
              )}
            </View>

            <View style={styles.emojiRow}>
              {moods.map((m) => {
                const isSelected = selectedMood === m.emoji;
                return (
                  <Pressable
                    key={m.emoji}
                    onPress={() => {
                      setSelectedMood(m.emoji);
                      setIsManuallySelected(true);
                    }}
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

            {/* Real-time Alert Banner */}
            {mentalAnalysis.primaryState !== 'normal' && (
              <Pressable
                onPress={() => setIsCrisisModalVisible(true)}
                style={[
                  styles.alertContainer,
                  mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                    ? { backgroundColor: '#FF3B3012', borderColor: '#FF3B3033' }
                    : mentalAnalysis.primaryState === 'anxiety'
                      ? { backgroundColor: '#FF950012', borderColor: '#FF950033' }
                      : { backgroundColor: '#5B4FE512', borderColor: '#5B4FE533' } // Burnout
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                      ? 'alert-octagon'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? 'alert-decagram'
                        : 'book-open-page-variant'
                  }
                  size={20}
                  color={
                    mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                      ? '#FF3B30'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? '#FF9500'
                        : theme.primary
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTextTitle, {
                    color: mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                      ? '#FF3B30'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? '#FF9500'
                        : theme.text
                  }]}>
                    {mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                      ? 'Immediate Support Suggested'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? 'Anxiety Patterns Detected'
                        : 'Academic Stress Detected'}
                  </Text>
                  <Text style={[styles.alertTextBody, { color: theme.textSecondary }]}>
                    {mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                      ? 'We care about your safety. Tap to view local crisis lines and grounding exercises.'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? "Feeling overwhelmed? Tap to try a quick calming breathing exercise."
                        : "Assignments or exam strain? Tap to see study break & coping tips."}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            )}

            <Button
              label={savingMood ? "Saving..." : "Save Daily Log"}
              variant="primary"
              onPress={handleLogMood}
              disabled={savingMood || !moodNote.trim()}
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
                        onPress={() => router.push({ pathname: '/video-call', params: { counselorName: nextSession.counselor_profile?.name || 'Counselor', counselorId: nextSession.counselor_id, callType: 'video' } })}
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

      {/* Crisis & Support Intervention Sheet */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isCrisisModalVisible}
        onRequestClose={() => setIsCrisisModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surfaceRaised, borderTopColor: theme.border }]}>
            <View style={styles.modalDragIndicator} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <MaterialCommunityIcons
                  name={
                    mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                      ? 'alert-octagon'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? 'alert-decagram'
                        : 'book-open-page-variant'
                  }
                  size={24}
                  color={
                    mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                      ? '#FF3B30'
                      : mentalAnalysis.primaryState === 'anxiety'
                        ? '#FF9500'
                        : theme.primary
                  }
                />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                    ? 'Crisis & Wellbeing Support'
                    : mentalAnalysis.primaryState === 'anxiety'
                      ? 'Grounding & Anxiety Relief'
                      : 'Academic Stress Guidance'}
                </Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setIsCrisisModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Subtitle */}
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {mentalAnalysis.primaryState === 'crisis' || mentalAnalysis.primaryState === 'depression'
                ? "Your safety and wellbeing are paramount. Please use the resources below to connect or calm yourself. We're here for you."
                : mentalAnalysis.primaryState === 'anxiety'
                  ? 'If your mind is racing or you feel overwhelmed, take a few minutes to reset your nervous system.'
                  : 'KNUST study loads can get heavy. Here are ways to manage burnout and get academic support.'}
            </Text>

            {/* Navigation Tabs inside Modal */}
            <View style={[styles.tabBar, { backgroundColor: theme.surfaceSoft }]}>
              <Pressable
                onPress={() => {
                  setActiveTab('coping');
                  setIsBreathingActive(false);
                }}
                style={[
                  styles.tabButton,
                  activeTab === 'coping' ? { backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border } : null
                ]}
              >
                <MaterialCommunityIcons
                  name="spa-outline"
                  size={16}
                  color={activeTab === 'coping' ? theme.primary : theme.textSecondary}
                />
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'coping' ? theme.text : theme.textSecondary }
                ]}>
                  Coping Tool
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setActiveTab('helplines');
                  setIsBreathingActive(false);
                }}
                style={[
                  styles.tabButton,
                  activeTab === 'helplines' ? { backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border } : null
                ]}
              >
                <MaterialCommunityIcons
                  name="phone-outline"
                  size={16}
                  color={activeTab === 'helplines' ? theme.primary : theme.textSecondary}
                />
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'helplines' ? theme.text : theme.textSecondary }
                ]}>
                  Helplines
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setActiveTab('chat');
                  setIsBreathingActive(false);
                }}
                style={[
                  styles.tabButton,
                  activeTab === 'chat' ? { backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border } : null
                ]}
              >
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={16}
                  color={activeTab === 'chat' ? theme.primary : theme.textSecondary}
                />
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'chat' ? theme.text : theme.textSecondary }
                ]}>
                  Counselors
                </Text>
              </Pressable>
            </View>

            {/* Tab Contents */}
            <View style={styles.tabContentContainer}>
              {activeTab === 'coping' && (
                <ScrollView contentContainerStyle={styles.tabScrollContent} showsVerticalScrollIndicator={false}>
                  {mentalAnalysis.primaryState === 'burnout' ? (
                    <View style={styles.burnoutSection}>
                      <Text style={[styles.sectionHeading, { color: theme.text }]}>📚 Coping with Academic Burnout</Text>

                      <View style={[styles.adviceCard, { backgroundColor: theme.surfaceSoft }]}>
                        <MaterialCommunityIcons name="clock-check-outline" size={20} color={theme.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.adviceTitle, { color: theme.text }]}>1. Structured Rest Breaks</Text>
                          <Text style={[styles.adviceBody, { color: theme.textSecondary }]}>
                            Use the Pomodoro technique. Study for 45 minutes, then take a 10-minute break completely away from screens.
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.adviceCard, { backgroundColor: theme.surfaceSoft }]}>
                        <MaterialCommunityIcons name="calendar-alert" size={20} color={theme.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.adviceTitle, { color: theme.text }]}>2. Workload Triaging</Text>
                          <Text style={[styles.adviceBody, { color: theme.textSecondary }]}>
                            List your assignments by deadline and weight. Focus on finishing only the top item today. Ignore the rest for now.
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.adviceCard, { backgroundColor: theme.surfaceSoft }]}>
                        <MaterialCommunityIcons name="pill" size={20} color={theme.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.adviceTitle, { color: theme.text }]}>3. Physical Recovery</Text>
                          <Text style={[styles.adviceBody, { color: theme.textSecondary }]}>
                            Burnout is physical fatigue. Prioritize 7-8 hours of sleep. Neural paths reload during slow-wave sleep.
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.breathingSection}>
                      <Text style={[styles.sectionHeading, { color: theme.text, textAlign: 'center' }]}>
                        🧘 4-7-8 Deep Breathing Exercise
                      </Text>
                      <Text style={[styles.sectionSubheading, { color: theme.textSecondary, textAlign: 'center' }]}>
                        Inhale for 4 seconds, hold for 7 seconds, and exhale for 8 seconds. This lowers heart rate and triggers the parasympathetic nervous system.
                      </Text>

                      {/* Visual Breathing Indicator */}
                      <View style={styles.breathingContainer}>
                        <View
                          style={[
                            styles.breathingCircle,
                            {
                              width: getCircleSize(),
                              height: getCircleSize(),
                              borderRadius: getCircleSize() / 2,
                              backgroundColor: getCircleColor(),
                            }
                          ]}
                        >
                          {isBreathingActive ? (
                            <View style={styles.breathingLabelWrapper}>
                              <Text style={styles.breathingStepText}>
                                {breathingStep === 'inhale' ? 'Inhale' : breathingStep === 'hold' ? 'Hold' : 'Exhale'}
                              </Text>
                              <Text style={styles.breathingTimerText}>{breathingTimer}s</Text>
                            </View>
                          ) : (
                            <MaterialCommunityIcons name="spa" size={36} color="#FFFFFF" />
                          )}
                        </View>
                      </View>

                      <Button
                        label={isBreathingActive ? "Stop Exercise" : "Start Breathing Exercise"}
                        variant={isBreathingActive ? "secondary" : "primary"}
                        onPress={() => setIsBreathingActive(!isBreathingActive)}
                        style={styles.breathingButton}
                      />
                    </View>
                  )}
                </ScrollView>
              )}

              {activeTab === 'helplines' && (
                <View style={styles.helplineSection}>
                  <Text style={[styles.sectionHeading, { color: theme.text }]}>📞 Immediate Crisis Contact</Text>
                  <Text style={[styles.sectionSubheading, { color: theme.textSecondary }]}>
                    Reach out for free, confidential mental health counseling and crisis intervention.
                  </Text>

                  <View style={styles.phoneList}>
                    <Pressable
                      onPress={() => Linking.openURL('tel:0322060352')}
                      style={[styles.phoneButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
                    >
                      <View style={[styles.phoneIconBg, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                        <MaterialCommunityIcons name="phone" size={20} color="#FF3B30" />
                      </View>
                      <View style={styles.phoneTextContainer}>
                        <Text style={[styles.phoneLabel, { color: theme.text }]} numberOfLines={1}>
                          KNUST Counseling Hotline (24/7)
                        </Text>
                        <Text style={[styles.phoneNumber, { color: theme.primary }]}>03220-60352</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                    </Pressable>

                    <Pressable
                      onPress={() => Linking.openURL('tel:+233596664444')}
                      style={[styles.phoneButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
                    >
                      <View style={[styles.phoneIconBg, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                        <MaterialCommunityIcons name="phone" size={20} color="#FF3B30" />
                      </View>
                      <View style={styles.phoneTextContainer}>
                        <Text style={[styles.phoneLabel, { color: theme.text }]} numberOfLines={1}>
                          Ghana Mental Health Helpline
                        </Text>
                        <Text style={[styles.phoneNumber, { color: theme.primary }]}>+233 59 666 4444</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              )}

              {activeTab === 'chat' && (
                <View style={styles.chatSection}>
                  <Text style={[styles.sectionHeading, { color: theme.text }]}>💬 Connect with Professional Support</Text>
                  <Text style={[styles.sectionSubheading, { color: theme.textSecondary }]}>
                    Reach out to one of our peer counselors or schedule an in-person session on campus.
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

            {/* Bottom Actions */}
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
  emojiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  emojiSectionTitle: {
    fontSize: FontSize.body - 2,
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
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  alertTextTitle: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
  },
  alertTextBody: {
    fontSize: FontSize.caption,
    marginTop: 2,
    lineHeight: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.four,
    maxHeight: '90%',
    borderTopWidth: 1,
    gap: Spacing.three,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
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
  modalTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  modalCloseButton: {
    padding: Spacing.one,
  },
  modalSubtitle: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
    marginBottom: Spacing.two,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 4,
    width: '100%',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two + 4,
    borderRadius: BorderRadius.md - 4,
  },
  tabText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  tabContentContainer: {
    minHeight: 280,
  },
  tabScrollContent: {
    paddingVertical: Spacing.two,
  },
  burnoutSection: {
    gap: Spacing.two + 2,
  },
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
    borderRadius: BorderRadius.md,
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
    shadowColor: '#5B4FE5',
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
  helplineSection: {
    paddingVertical: Spacing.two,
  },
  phoneList: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: '100%',
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
  modalFooter: {
    marginTop: Spacing.two,
  },
  modalDismissBtn: {
    width: '100%',
  },
});
