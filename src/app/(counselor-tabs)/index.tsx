import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card, SectionHeader } from '@/components/ui';
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
import {
  fetchAppointments,
  updateAppointmentStatus,
  SupabaseAppointment
} from '@/lib/supabase-db';

export default function CounselorDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, role } = useMockAuth();

  const [appointments, setAppointments] = useState<SupabaseAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const loadAppointmentsList = async () => {
    try {
      const list = await fetchAppointments(currentUserId, 'counselor');
      setAppointments(list);
    } catch (err) {
      console.warn('Error loading counselor appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAppointmentsList();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleAcceptRequest = async (id: string, name: string) => {
    try {
      await updateAppointmentStatus(id, 'accepted');
      Alert.alert('Request Accepted', `Session with ${name} has been added to your schedule.`);
      loadAppointmentsList();
    } catch (err: any) {
      console.warn('Error accepting appointment:', err);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'accepted' } : a));
      Alert.alert('Request Accepted', `Session with ${name} added.`);
    }
  };

  const handleDeclineRequest = async (id: string, name: string) => {
    try {
      await updateAppointmentStatus(id, 'declined');
      Alert.alert('Request Declined', `Booking request from ${name} was declined.`);
      loadAppointmentsList();
    } catch (err: any) {
      console.warn('Error declining appointment:', err);
      setAppointments(prev => prev.filter(a => a.id !== id));
      Alert.alert('Request Declined', `Request from ${name} declined.`);
    }
  };

  const pendingRequests = appointments.filter(a => a.status === 'pending');
  const acceptedAgenda = appointments.filter(a => a.status === 'accepted');

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 128 },
        ]}>
        <View style={styles.container}>
          {/* Greeting Section */}
          <View style={styles.headerRow}>
            <View style={styles.greetingBlock}>
              <View style={[styles.eyebrowWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Text style={[styles.eyebrow, { color: theme.primary }]}>Counselor Portal</Text>
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Hello, {userName.split(' ')[0] || 'Kwame'}.</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Here is your schedule, incoming booking requests, and message box.
              </Text>
            </View>
            <Pressable
              style={[styles.bellButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
              onPress={() => router.push('/notifications')}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={theme.text} />
            </Pressable>
          </View>

          {/* Metrics */}
          <View style={styles.statRow}>
            <MetricCard icon="account-multiple-outline" label="Agenda slots" value={`${acceptedAgenda.length} Active`} />
            <MetricCard icon="clock-outline" label="Open Requests" value={`${pendingRequests.length} Pending`} />
            <MetricCard icon="star-outline" label="User Rating" value="4.9 / 5" />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <>
              {/* Agenda list */}
              <SectionHeader title="Today's Agenda" />
              <View style={styles.agendaStack}>
                {acceptedAgenda.length > 0 ? (
                  acceptedAgenda.map((agenda) => (
                    <Card key={agenda.id} variant="raised" padding="three" style={styles.agendaCard}>
                      <View style={styles.agendaTopRow}>
                        <View style={styles.agendaInfo}>
                          <Text style={[styles.agendaTime, { color: theme.primary }]}>{agenda.time_slot}</Text>
                          <Text style={[styles.agendaStudent, { color: theme.text }]}>
                            {agenda.student_profile?.name || "Student"}
                          </Text>
                          <Text style={[styles.agendaTopic, { color: theme.textSecondary }]}>
                            Concern: {agenda.topic || 'General Wellbeing'}
                          </Text>
                        </View>
                        <View style={styles.agendaMeta}>
                          <View style={[styles.typePill, { backgroundColor: theme.surfaceSoft }]}>
                            <Text style={[styles.typeText, { color: theme.primary }]}>Video Call</Text>
                          </View>
                          <Button
                            label="Start Call"
                            variant="primary"
                            icon="video"
                            onPress={() => router.push('/video-call')}
                            style={styles.actionBtn}
                          />
                        </View>
                      </View>
                    </Card>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="calendar-blank" size={32} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No approved sessions scheduled for today.
                    </Text>
                  </View>
                )}
              </View>

              {/* Booking Request list */}
              <SectionHeader title={`Pending Requests (${pendingRequests.length})`} />
              <View style={styles.requestStack}>
                {pendingRequests.length > 0 ? (
                  pendingRequests.map((req) => {
                    const studentName = req.student_profile?.name || "Anonymous Student";
                    return (
                      <Card key={req.id} variant="surface" padding="three" style={styles.requestCard}>
                        <View style={styles.requestContent}>
                          <Avatar name={studentName} size="md" />
                          <View style={styles.requestDetails}>
                            <Text style={[styles.requestStudent, { color: theme.text }]}>{studentName}</Text>
                            <Text style={[styles.requestIssue, { color: theme.textSecondary }]}>Concern: {req.topic || 'Mental Support'}</Text>
                            <View style={styles.slotDetails}>
                              <MaterialCommunityIcons name="calendar-clock" size={14} color={theme.textSecondary} />
                              <Text style={[styles.slotText, { color: theme.textSecondary }]}>
                                {req.time_slot} ({new Date(req.appointment_date).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.requestButtonsRow}>
                          <Button
                            label="Decline"
                            variant="secondary"
                            onPress={() => handleDeclineRequest(req.id, studentName)}
                            style={[styles.btnHalf, { borderColor: '#FECACA' }]}
                          />
                          <Button
                            label="Accept"
                            variant="primary"
                            onPress={() => handleAcceptRequest(req.id, studentName)}
                            style={styles.btnHalf}
                          />
                        </View>
                      </Card>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="check-decagram-outline" size={42} color={theme.success} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      All caught up! No pending requests.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
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
    <Card variant="surface" padding="two" style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.primary} />
      </View>
      <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  loadingContainer: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.md,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.medium,
  },
  metricValue: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
  },
  agendaStack: {
    gap: Spacing.two,
  },
  agendaCard: {
    borderRadius: BorderRadius.md,
  },
  agendaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  agendaInfo: {
    flex: 1,
    gap: 2,
  },
  agendaTime: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  agendaStudent: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  agendaTopic: {
    fontSize: FontSize.caption,
  },
  agendaMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  typePill: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  typeText: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
  },
  actionBtn: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
  },
  requestStack: {
    gap: Spacing.three,
  },
  requestCard: {
    gap: Spacing.three,
    borderRadius: BorderRadius.md,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.medium,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
