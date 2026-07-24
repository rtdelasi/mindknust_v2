import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchAppointments,
  updateAppointmentStatus,
  SupabaseAppointment,
} from '@/lib/supabase-db';

export default function CounselorDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, role, avatarUrl } = useMockAuth();

  const [appointments, setAppointments] = useState<SupabaseAppointment[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentUserId =
    auth?.currentUser?.uid ||
    (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const fetchUnreadCount = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('id, is_read')
        .or(`user_id.is.null,user_id.eq.${currentUserId}`);

      if (!error && data) {
        const localReadJson = await AsyncStorage.getItem('counselcare_read_notification_ids');
        const localReadIds: string[] = localReadJson ? JSON.parse(localReadJson) : [];

        const count = data.filter(
          (n: any) => !n.is_read && !localReadIds.includes(n.id)
        ).length;

        setUnreadCount(count);
      }
    } catch (err) {
      console.warn('Error fetching unread count:', err);
    }
  };

  const loadAppointmentsList = async () => {
    try {
      const list = await fetchAppointments(currentUserId, 'counselor');
      setAppointments(list);
      await fetchUnreadCount();
    } catch (err) {
      console.warn('Error loading counselor appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time notification badge updates
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('counselor-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notif = payload.new as { user_id: string | null };
          if (!notif.user_id || notif.user_id === currentUserId) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      loadAppointmentsList();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleAcceptRequest = async (id: string, name: string) => {
    try {
      await updateAppointmentStatus(id, 'accepted');
      Alert.alert(
        'Request Accepted',
        `Session with ${name} has been added to your schedule.`
      );
      loadAppointmentsList();
    } catch (err: any) {
      console.warn('Error accepting appointment:', err);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'accepted' } : a))
      );
      Alert.alert('Request Accepted', `Session with ${name} added.`);
    }
  };

  const handleDeclineRequest = async (id: string, name: string) => {
    try {
      await updateAppointmentStatus(id, 'declined');
      Alert.alert(
        'Request Declined',
        `Booking request from ${name} was declined.`
      );
      loadAppointmentsList();
    } catch (err: any) {
      console.warn('Error declining appointment:', err);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      Alert.alert('Request Declined', `Request from ${name} declined.`);
    }
  };

  const pendingRequests = appointments.filter((a) => a.status === 'pending');
  const acceptedAgenda = appointments.filter((a) => a.status === 'accepted');

  const firstName = userName.split(' ')[0] || 'Counselor';

  // Dynamic subtitle based on real data
  const subtitleText = useMemo(() => {
    if (acceptedAgenda.length === 0 && pendingRequests.length === 0) {
      return `Your schedule is looking clear for today.`;
    }
    const parts: string[] = [];
    if (acceptedAgenda.length > 0) {
      parts.push(
        `You have ${acceptedAgenda.length} active session${acceptedAgenda.length !== 1 ? 's' : ''} remaining.`
      );
    }
    if (pendingRequests.length > 0) {
      parts.push(
        `${pendingRequests.length} pending request${pendingRequests.length !== 1 ? 's' : ''} awaiting your review.`
      );
    }
    return parts.join(' ');
  }, [acceptedAgenda.length, pendingRequests.length]);

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
          {/* ── Header with avatar ── */}
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
                    { backgroundColor: theme.success },
                  ]}
                />
              </View>
              <View style={styles.greetingBlock}>
                <View
                  style={[
                    styles.eyebrowWrap,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text style={[styles.eyebrow, { color: theme.primary }]}>
                    Counselor Portal
                  </Text>
                </View>
                <Text style={[styles.title, { color: theme.text }]}>
                  Hello, {firstName}.
                </Text>
                <Text
                  style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {subtitleText}
                </Text>
              </View>
            </View>
            <Pressable
              style={[
                styles.bellButton,
                {
                  backgroundColor: theme.surfaceRaised,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => router.push('/notifications')}>
              <Badge
                count={unreadCount}
                size={19}
                max={9}
                color="#FF3B30"
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

          {/* ── Stat cards ── */}
          <View style={styles.statRow}>
            <MetricCard
              icon="clipboard-text-clock-outline"
              label="Agenda Slots"
              value={`${acceptedAgenda.length} Active`}
              theme={theme}
            />
            <MetricCard
              icon="email-outline"
              label="Open Requests"
              value={`${pendingRequests.length} Pending`}
              theme={theme}
            />
            <MetricCard
              icon="star-outline"
              label="User Rating"
              value="4.9 / 5"
              trend="+0.2"
              theme={theme}
            />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <>
              {/* ── Today's Agenda ── */}
              <SectionHeader
                title={
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons
                      name="clipboard-text-outline"
                      size={18}
                      color={theme.text}
                    />
                    <Text
                      style={{
                        fontSize: FontSize.h3,
                        fontWeight: FontWeight.bold,
                        color: theme.text,
                        letterSpacing: -0.2,
                      }}>
                      {"Today's Agenda"}
                    </Text>
                  </View>
                }
                actionLabel="View all →"
                onActionPress={() => router.push('/(counselor-tabs)/sessions')}
              />

              <View style={styles.agendaStack}>
                {acceptedAgenda.length > 0 ? (
                  acceptedAgenda.map((agenda) => (
                    <Card
                      key={agenda.id}
                      variant="raised"
                      padding="three"
                      style={styles.agendaCard}>
                      {/* Top row: time + student + type pill */}
                      <View style={styles.agendaHeader}>
                        <View style={styles.agendaTimeRow}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={14}
                            color={theme.primary}
                          />
                          <Text
                            style={[
                              styles.agendaTime,
                              { color: theme.primary },
                            ]}>
                            {agenda.time_slot}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.typePill,
                            { backgroundColor: theme.surfaceSoft },
                          ]}>
                          <MaterialCommunityIcons
                            name="video-outline"
                            size={12}
                            color={theme.primary}
                          />
                          <Text
                            style={[
                              styles.typeText,
                              { color: theme.primary },
                            ]}>
                            Video Call
                          </Text>
                        </View>
                      </View>

                      {/* Student name */}
                      <Text
                        style={[
                          styles.agendaStudent,
                          { color: theme.text },
                        ]}>
                        {agenda.student_profile?.name || 'Student'}
                      </Text>

                      {/* Concern block — uppercase label + wrap */}
                      <View style={styles.concernBlock}>
                        <Text
                          style={[
                            styles.concernLabel,
                            { color: theme.textSecondary },
                          ]}>
                          CONCERN:
                        </Text>
                        <Text
                          style={[
                            styles.concernText,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={2}>
                          {agenda.topic || 'General Wellbeing'}
                        </Text>
                      </View>

                      {/* Full-width start session button */}
                      <Button
                        label="Start Session"
                        variant="primary"
                        icon="video"
                        onPress={() =>
                          router.push({
                            pathname: '/video-call',
                            params: {
                              counselorName:
                                agenda.student_profile?.name || 'Student',
                              counselorId: agenda.student_id,
                              callType: 'video',
                            },
                          })
                        }
                        style={styles.fullWidthBtn}
                      />
                    </Card>
                  ))
                ) : (
                  <View
                    style={[
                      styles.emptyState,
                      { backgroundColor: theme.surfaceSoft },
                    ]}>
                    <MaterialCommunityIcons
                      name="calendar-blank"
                      size={32}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.emptyTitle,
                        { color: theme.text },
                      ]}>
                      No sessions today
                    </Text>
                    <Text
                      style={[
                        styles.emptySubtext,
                        { color: theme.textSecondary },
                      ]}>
                      Approved sessions will appear here.
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Pending Requests ── */}
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={18}
                  color={theme.text}
                />
                <Text
                  style={[
                    styles.sectionTitleText,
                    { color: theme.text },
                  ]}>
                  Pending Requests ({pendingRequests.length})
                </Text>
              </View>

              <View style={styles.requestStack}>
                {pendingRequests.length > 0 ? (
                  pendingRequests.map((req) => {
                    const studentName =
                      req.student_profile?.name || 'Anonymous Student';
                    return (
                      <Card
                        key={req.id}
                        variant="surface"
                        padding="three"
                        style={styles.requestCard}>
                        <View style={styles.requestContent}>
                          <Avatar name={studentName} size="md" />
                          <View style={styles.requestDetails}>
                            <Text
                              style={[
                                styles.requestStudent,
                                { color: theme.text },
                              ]}>
                              {studentName}
                            </Text>
                            <Text
                              style={[
                                styles.requestIssue,
                                { color: theme.textSecondary },
                              ]}>
                              Concern: {req.topic || 'Mental Support'}
                            </Text>
                            <View style={styles.slotDetails}>
                              <MaterialCommunityIcons
                                name="calendar-clock"
                                size={14}
                                color={theme.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.slotText,
                                  { color: theme.textSecondary },
                                ]}>
                                {req.time_slot} (
                                {new Date(
                                  req.appointment_date
                                ).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                                )
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.requestButtonsRow}>
                          <Button
                            label="Decline"
                            variant="secondary"
                            onPress={() =>
                              handleDeclineRequest(req.id, studentName)
                            }
                            style={[
                              styles.btnHalf,
                              { borderColor: '#FECACA' },
                            ]}
                          />
                          <Button
                            label="Accept"
                            variant="primary"
                            onPress={() =>
                              handleAcceptRequest(req.id, studentName)
                            }
                            style={styles.btnHalf}
                          />
                        </View>
                      </Card>
                    );
                  })
                ) : (
                  <View
                    style={[
                      styles.emptyCard,
                      { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
                    ]}>
                    <View
                      style={[
                        styles.emptyIconCircle,
                        { backgroundColor: theme.primarySoft },
                      ]}>
                      <MaterialCommunityIcons
                        name="check-all"
                        size={28}
                        color={theme.primary}
                      />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>
                      All caught up!
                    </Text>
                    <Text
                      style={[
                        styles.emptySubtext,
                        { color: theme.textSecondary },
                      ]}>
                      You have no pending requests at this time.
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Next Steps ── */}
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="flag-outline"
                  size={18}
                  color={theme.text}
                />
                <Text
                  style={[styles.sectionTitleText, { color: theme.text }]}>
                  NEXT STEPS
                </Text>
              </View>

              <Card variant="surface" padding="three" style={styles.nextStepsCard}>
                <Pressable
                  style={styles.nextStepsItem}
                  onPress={() =>
                    router.push('/(counselor-tabs)/sessions')
                  }>
                  <View style={styles.nextStepsLeft}>
                    <View
                      style={[
                        styles.nextStepsIconWrap,
                        { backgroundColor: theme.accentSoft },
                      ]}>
                      <MaterialCommunityIcons
                        name="note-text-outline"
                        size={18}
                        color={theme.primary}
                      />
                    </View>
                    <View style={styles.nextStepsTextWrap}>
                      <Text
                        style={[
                          styles.nextStepsLabel,
                          { color: theme.text },
                        ]}>
                        Update session notes
                      </Text>
                      <Text
                        style={[
                          styles.nextStepsSubtext,
                          { color: theme.textSecondary },
                        ]}>
                        Complete notes from your most recent session
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   MetricCard — left-aligned, icon in circular badge
   ───────────────────────────────────────────── */
function MetricCard({
  icon,
  label,
  value,
  trend,
  theme,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  trend?: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Card variant="surface" padding="two" style={styles.metricCard}>
      <View
        style={[
          styles.metricIconCircle,
          { backgroundColor: theme.primarySoft },
        ]}>
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={theme.primary}
        />
      </View>
      <View style={styles.metricTextBlock}>
        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
          {label}
        </Text>
        <View style={styles.metricValueRow}>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {value}
          </Text>
          {trend ? (
            <View style={styles.trendChip}>
              <MaterialCommunityIcons
                name="arrow-up"
                size={12}
                color={theme.success}
              />
              <Text
                style={[styles.trendText, { color: theme.success }]}>
                {trend}
              </Text>
            </View>
          ) : null}
        </View>
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
    gap: Spacing.three,
  },

  /* ── Header ── */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  avatarWrap: {
    position: 'relative',
    marginTop: 2,
  },
  statusDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  greetingBlock: {
    flex: 1,
    gap: 4,
  },
  eyebrowWrap: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
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

  /* ── Stats ── */
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  metricCard: {
    flex: 1,
    gap: Spacing.two,
    borderRadius: BorderRadius.sm,
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTextBlock: {
    gap: 2,
  },
  metricLabel: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.medium,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  trendText: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
  },

  /* ── Agenda ── */
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionTitleText: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  agendaStack: {
    gap: Spacing.two,
  },
  agendaCard: {
    borderRadius: BorderRadius.sm,
    gap: Spacing.two,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agendaTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  agendaTime: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  typeText: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
  },
  agendaStudent: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  concernBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  concernLabel: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  concernText: {
    fontSize: FontSize.caption,
    flex: 1,
    lineHeight: 18,
  },
  fullWidthBtn: {
    marginTop: Spacing.one,
  },

  /* ── Requests ── */
  requestStack: {
    gap: Spacing.three,
  },
  requestCard: {
    gap: Spacing.three,
    borderRadius: BorderRadius.sm,
  },
  requestContent: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  requestDetails: {
    flex: 1,
    gap: 2,
  },
  requestStudent: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  requestIssue: {
    fontSize: FontSize.caption,
  },
  slotDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  slotText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  requestButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btnHalf: {
    flex: 1,
    minHeight: 40,
  },

  /* ── Empty states ── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
    borderRadius: BorderRadius.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  emptySubtext: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Next Steps ── */
  nextStepsCard: {
    borderRadius: BorderRadius.sm,
  },
  nextStepsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextStepsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  nextStepsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepsTextWrap: {
    gap: 2,
    flex: 1,
  },
  nextStepsLabel: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  nextStepsSubtext: {
    fontSize: FontSize.small,
  },
});
