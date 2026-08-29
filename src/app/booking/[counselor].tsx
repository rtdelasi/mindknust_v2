import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Tag } from '@/components/ui/tag';
import { WeekDatePicker } from '@/components/ui/week-date-picker';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  MaxContentWidth,
  Size,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import {
  fetchCounselors,
  fetchAvailabilitySlots,
  rescheduleAppointment,
  SupabaseSlot,
  SupabaseCounselor,
  bookSlot,
  fetchBookedSlots,
} from '@/lib/supabase-db';
import { parseCounselorNote, serializeAppointmentTopic } from '@/lib/counselor-utils';
import { supabase, hasSupabaseConfig } from '@/lib/supabase';
import { scheduleSessionReminder } from '@/lib/notification-service';

export default function BookingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ counselor?: string; rescheduleId?: string }>();
  const counselor = params.counselor ?? 'Counselor';
  const rescheduleId = params.rescheduleId;
  const { role, anonymousId, userName } = useMockAuth();

  const [loading, setLoading] = useState(true);
  const [counselorData, setCounselorData] = useState<SupabaseCounselor | null>(null);
  const [slots, setSlots] = useState<SupabaseSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlotText, setSelectedSlotText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('Academic stress');
  const [submitting, setSubmitting] = useState(false);
  const [anonDisplay, setAnonDisplay] = useState(false);
  const [sessionType, setSessionType] = useState<'online' | 'in-person'>('online');
  const [counselorFormats, setCounselorFormats] = useState({ online: true, inPerson: false });
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  const selectedDayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const filteredSlots = slots.filter(
    (s) =>
      s.day_of_week?.trim().toLowerCase() === selectedDayName.trim().toLowerCase() &&
      !bookedSlots.includes(s.time_slot)
  );

  const loadBookedSlots = async (cId: string, targetDate: Date) => {
    const formattedDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    try {
      const booked = await fetchBookedSlots(cId, formattedDate);
      setBookedSlots(booked);
    } catch (err) {
      console.warn('Error fetching booked slots:', err);
    }
  };

  const loadCounselorDetails = async () => {
    try {
      const list = await fetchCounselors();
      const match = list.find((c) => c.id === counselor);
      if (match) {
        setCounselorData(match);
        const avSlots = await fetchAvailabilitySlots(match.id);
        setSlots(avSlots);
        await loadBookedSlots(match.id, selectedDate);
        
        // Parse formats
        const { formats } = parseCounselorNote(match.note || '');
        setCounselorFormats(formats);
        if (formats.online) {
          setSessionType('online');
        } else if (formats.inPerson) {
          setSessionType('in-person');
        }
      } else {
        // Fallback mockup
        const fallbackNote = 'Online session - 30 minutes';
        const { formats } = parseCounselorNote(fallbackNote);
        setCounselorFormats(formats);
        setSessionType('online');
        
        setCounselorData({
          id: counselor,
          specialties: ['Anxiety', 'Academic stress', 'Relationships'],
          rating: 4.9,
          review_count: 0,
          note: fallbackNote,
          bio: 'Licensed KNUST student counselor providing support.',
          profile: {
            id: counselor,
            name: formatCounselorName(counselor),
            email: `${counselor}@knust.edu.gh`,
            role: 'counselor',
            created_at: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      console.warn('Error loading counselor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounselorDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counselor]);

  // Reload booked slots when selectedDate or counselor changes
  useEffect(() => {
    const cId = counselorData?.id || counselor;
    if (cId) {
      loadBookedSlots(cId, selectedDate);
    }
  }, [selectedDate, counselorData?.id]);

  // Supabase Realtime synchronization for appointments
  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;
    const cId = counselorData?.id || counselor;
    if (!cId) return;

    console.log(`[Realtime] Subscribing to appointments for counselor ${cId}`);
    const channel = supabase
      .channel(`counselor-appointments-${cId}`)
      .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'appointments',
           filter: `counselor_id=eq.${cId}`,
         },
         () => {
           console.log('[Realtime] Counselor appointments updated, reloading booked slots...');
           loadBookedSlots(cId, selectedDate);
         }
      )
      .subscribe();

    return () => {
      console.log(`[Realtime] Unsubscribing from appointments for counselor ${cId}`);
      supabase?.removeChannel(channel);
    };
  }, [counselorData?.id, selectedDate]);

  useEffect(() => {
    const daySlots = slots.filter(
      (s) => s.day_of_week?.trim().toLowerCase() === selectedDayName.trim().toLowerCase()
    );
    if (daySlots.length > 0) {
      const remainingSlots = daySlots.filter((s) => !bookedSlots.includes(s.time_slot));
      if (remainingSlots.length > 0) {
        const isValid = remainingSlots.some((s) => s.time_slot === selectedSlotText);
        if (!isValid) {
          setSelectedSlotText(remainingSlots[0].time_slot);
        }
      } else {
        setSelectedSlotText('');
      }
    } else {
      setSelectedSlotText('');
    }
  }, [selectedDate, slots, bookedSlots]);

  const formatCounselorName = (value: string) => {
    return value
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlotText || filteredSlots.length === 0) {
      Alert.alert('Booking Error', `No available slot selected for ${selectedDayName}.`);
      return;
    }

    setSubmitting(true);
    const studentId = auth?.currentUser?.uid || 'student-user';
    const cId = counselorData?.id || counselor;
    const formattedDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const formattedDisplayDate = selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const nameVal = counselorData?.profile?.name || formatCounselorName(counselor);

    try {
      if (rescheduleId) {
        await rescheduleAppointment(rescheduleId, studentId, cId, formattedDate, selectedSlotText);
        
        // Schedule reminder for rescheduled session
        scheduleSessionReminder(
          rescheduleId,
          nameVal,
          formattedDate,
          selectedSlotText
        ).catch((e) => console.warn('[Booking] Reschedule notification failed:', e));

        Alert.alert(
          'Appointment Rescheduled',
          `Your appointment with ${nameVal} has been rescheduled to ${formattedDisplayDate} at ${selectedSlotText}.`,
          [{ text: 'OK', onPress: () => router.push('/(tabs)/sessions') }]
        );
      } else {
        const topicWithFormat = serializeAppointmentTopic(selectedTopic, sessionType);
        const result = await bookSlot(studentId, cId, formattedDate, selectedSlotText, topicWithFormat, anonDisplay);
        
        if (!result.success) {
          if (result.reason === 'already_booked') {
            Alert.alert('Booking Error', 'This slot was just booked. Please pick another.');
            await loadBookedSlots(cId, selectedDate);
            setSubmitting(false);
            return;
          }
          throw new Error(result.reason || 'Failed to book slot.');
        }

        // Schedule reminder for newly booked session
        if (result.appointment?.id) {
          scheduleSessionReminder(
            result.appointment.id,
            nameVal,
            formattedDate,
            selectedSlotText
          ).catch((e) => console.warn('[Booking] Notification schedule failed:', e));
        }

        Alert.alert(
          'Booking Confirmed',
          `Your appointment with ${nameVal} on ${formattedDisplayDate} at ${selectedSlotText} (${sessionType === 'in-person' ? 'In-Person' : 'Online'}) has been scheduled.`,
          [{ text: 'OK', onPress: () => router.push('/(tabs)/sessions') }]
        );
      }
    } catch (err: any) {
      console.warn('DB action failed:', err);
      if (err && (err.code === '23505' || err.message?.includes('duplicate key') || err.reason === 'already_booked')) {
        Alert.alert('Booking Error', 'This slot was just booked. Please pick another.');
        await loadBookedSlots(cId, selectedDate);
      } else {
        if (rescheduleId) {
          // Schedule fallback reminder
          scheduleSessionReminder(
            rescheduleId,
            nameVal,
            formattedDate,
            selectedSlotText
          ).catch((e) => console.warn('[Booking] Notification schedule fallback failed:', e));

          Alert.alert(
            'Appointment Rescheduled',
            `Rescheduled with ${nameVal} on ${formattedDisplayDate} at ${selectedSlotText}.`,
            [{ text: 'OK', onPress: () => router.push('/(tabs)/sessions') }]
          );
        } else {
          Alert.alert(
            'Booking Confirmed',
            `Scheduled with ${nameVal} on ${formattedDisplayDate} at ${selectedSlotText} (${selectedTopic} - ${sessionType === 'in-person' ? 'In-Person' : 'Online'}).`,
            [{ text: 'OK', onPress: () => router.push('/(tabs)/sessions') }]
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const nameVal = counselorData?.profile?.name || formatCounselorName(counselor);
  const ratingVal = counselorData?.rating || '4.9';
  const specialties = counselorData?.specialties || ['Anxiety', 'Academic stress'];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 128 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>
              {rescheduleId ? 'Session rescheduling' : 'Session booking'}
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {rescheduleId ? 'Reschedule session' : 'Book a counselor'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {rescheduleId
                ? 'Choose a new date and available time slot to reschedule your session.'
                : 'Choose a date and available time slot to lock in your next support session.'}
            </Text>
          </View>

          <Card variant="surface" padding="four">
            <View style={styles.summaryRow}>
              <Avatar name={nameVal} size="lg" />
              <View style={styles.summaryText}>
                <Text style={[styles.name, { color: theme.text }]}>{nameVal}</Text>
                <Text style={[styles.role, { color: theme.textSecondary }]}>Student counselor - {ratingVal} rating</Text>
                <Text style={[styles.note, { color: theme.textSecondary }]}>Online session - 30 minutes</Text>
              </View>
            </View>
            <View style={styles.tagRow}>
              {specialties.map((spec) => (
                <Tag key={spec} label={spec} active={selectedTopic === spec} onPress={() => setSelectedTopic(spec)} />
              ))}
            </View>
          </Card>

          {/* Format Selector block */}
          <Card variant="surface" padding="four">
            <SectionHeader title="Session Format" />
            {counselorFormats.online && counselorFormats.inPerson ? (
              <View style={styles.formatSelectorRow}>
                <Pressable
                  onPress={() => setSessionType('online')}
                  style={[
                    styles.formatOption,
                    { borderColor: theme.border, backgroundColor: theme.surfaceSoft },
                    sessionType === 'online' && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}>
                  <MaterialCommunityIcons
                    name="video-outline"
                    size={20}
                    color={sessionType === 'online' ? '#FFFFFF' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.formatOptionText,
                      { color: theme.textSecondary },
                      sessionType === 'online' && { color: '#FFFFFF', fontWeight: FontWeight.bold },
                    ]}>
                    Online
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSessionType('in-person')}
                  style={[
                    styles.formatOption,
                    { borderColor: theme.border, backgroundColor: theme.surfaceSoft },
                    sessionType === 'in-person' && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}>
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={20}
                    color={sessionType === 'in-person' ? '#FFFFFF' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.formatOptionText,
                      { color: theme.textSecondary },
                      sessionType === 'in-person' && { color: '#FFFFFF', fontWeight: FontWeight.bold },
                    ]}>
                    In-Person
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.singleFormatBadge, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
                <MaterialCommunityIcons
                  name={counselorFormats.inPerson ? 'map-marker-outline' : 'video-outline'}
                  size={22}
                  color={theme.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.singleFormatTitle, { color: theme.text }]}>
                    {counselorFormats.inPerson ? 'In-Person Session Only' : 'Online Session Only'}
                  </Text>
                  <Text style={[styles.singleFormatDesc, { color: theme.textSecondary }]}>
                    {counselorFormats.inPerson
                      ? 'This counselor only accommodates in-person meetings on campus.'
                      : 'This counselor only accommodates online conference calls.'}
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {/* Date Selector block */}
          <Card variant="surface" padding="four">
            <SectionHeader title="Select a Date" />
            <WeekDatePicker
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              minDate={new Date()}
            />
          </Card>

          {/* Time Selector block */}
          <Card variant="surface" padding="four">
            <SectionHeader title={`Available Time Slots (${selectedDayName})`} />
            {filteredSlots.length > 0 ? (
              <View style={styles.slotGrid}>
                {filteredSlots.map((s) => {
                  const slot = s.time_slot;
                  const isActive = selectedSlotText === slot;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedSlotText(slot)}
                      style={[
                        styles.slot,
                        { borderColor: theme.border, backgroundColor: theme.surfaceSoft },
                        isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}>
                      <Text style={[styles.slotText, { color: theme.textSecondary }, isActive && { color: '#FFFFFF', fontWeight: FontWeight.bold }]}>
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.noSlotsCard, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
                <MaterialCommunityIcons name="calendar-remove" size={26} color="#FF3B30" />
                <Text style={[styles.noSlotsText, { color: theme.textSecondary }]}>
                  This counselor has no availability slots allocated for {selectedDayName}. Please select a different day.
                </Text>
              </View>
            )}
          </Card>

          <Card variant="surface" padding="four">
            <SectionHeader title="What would you like help with?" />
            <View style={[styles.noteBox, { backgroundColor: theme.surfaceSoft }]}>
              <MaterialCommunityIcons
                name="message-text-outline"
                size={Size.iconSm + 4}
                color={theme.primary}
              />
              <Text style={[styles.noteText, { color: theme.text }]}>Select a concern from below to focus the counseling plan.</Text>
            </View>
            <View style={styles.hintRow}>
              {['Exam pressure', 'Sleep hygiene', 'Relationship boundaries', 'Loneliness'].map((topic) => {
                const isActive = selectedTopic === topic;
                return (
                  <Tag
                    key={topic}
                    label={topic}
                    active={isActive}
                    onPress={() => setSelectedTopic(topic)}
                  />
                );
              })}
            </View>
          </Card>

          {role === 'student' && anonymousId ? (
            <Card variant="surface" padding="four">
              <View style={styles.anonRow}>
                <View style={styles.anonInfo}>
                  <MaterialCommunityIcons name="incognito" size={22} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.anonLabel, { color: theme.text }]}>
                      Show my name as {anonDisplay ? anonymousId : userName}
                    </Text>
                    <Text style={[styles.anonHint, { color: theme.textSecondary }]}>
                      Other students see your anonymous ID. Your counselor always sees your real name.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={anonDisplay}
                  onValueChange={setAnonDisplay}
                  trackColor={{ false: theme.surfaceSoft, true: `${theme.primary}40` }}
                  thumbColor={anonDisplay ? theme.primary : '#f4f3f4'}
                />
              </View>
            </Card>
          ) : null}

          <Button
            label={submitting ? (rescheduleId ? 'Rescheduling...' : 'Booking...') : (rescheduleId ? 'Confirm Rescheduling' : 'Confirm booking')}
            disabled={submitting || filteredSlots.length === 0 || !selectedSlotText}
            onPress={handleConfirmBooking}
          />
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
    fontSize: FontSize.small + 1,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: FontSize.h1,
    lineHeight: 36,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: FontSize.body - 1,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  role: {
    fontSize: FontSize.caption,
  },
  note: {
    fontSize: FontSize.caption - 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  slot: {
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  slotText: {
    fontSize: FontSize.caption + 1,
  },
  noSlotsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  noSlotsText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
    flex: 1,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.two,
  },
  noteText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
    flex: 1,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  anonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  anonLabel: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.semibold,
  },
  anonHint: {
    fontSize: FontSize.small,
    lineHeight: 16,
    marginTop: 2,
  },
  formatSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  formatOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  formatOptionText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.semibold,
  },
  singleFormatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  singleFormatTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  singleFormatDesc: {
    fontSize: FontSize.caption,
    marginTop: 2,
    lineHeight: 16,
  },
});
