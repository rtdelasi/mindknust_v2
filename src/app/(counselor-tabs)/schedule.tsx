import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import {
  fetchAvailabilitySlots,
  addAvailabilitySlot,
  deleteAvailabilitySlot,
  SupabaseSlot,
} from '@/lib/supabase-db';

const timeOptions = [
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM'
];

export default function CounselorScheduleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [activeDay, setActiveDay] = useState<string>('Monday');
  const [slots, setSlots] = useState<SupabaseSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Time Slider states
  const [sliderIndex, setSliderIndex] = useState(4); // Default to 10:00 AM
  const [sliderWidth, setSliderWidth] = useState(250);

  // Settings switches
  const [autoAccept, setAutoAccept] = useState(false);
  const [requireManualReview, setRequireManualReview] = useState(true);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const loadSlots = async () => {
    try {
      const list = await fetchAvailabilitySlots(currentUserId);
      setSlots(list);
    } catch (err) {
      console.warn('Error loading schedule slots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await deleteAvailabilitySlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err: any) {
      Alert.alert('Delete Failed', err.message || 'Could not delete slot.');
    }
  };

  const handleAddSlot = async () => {
    setSubmitting(true);
    const selectedTime = timeOptions[sliderIndex];

    // Check if slot already exists for active day
    const alreadyExists = slots.some(
      (s) => s.day_of_week === activeDay && s.time_slot.trim().toLowerCase() === selectedTime.trim().toLowerCase()
    );
    if (alreadyExists) {
      Alert.alert('Duplicate Slot', `You have already added ${selectedTime} to your ${activeDay} list.`);
      setSubmitting(false);
      return;
    }

    try {
      const created = await addAvailabilitySlot(currentUserId, activeDay, selectedTime);
      if (created) {
        setSlots((prev) => [...prev, created]);
      } else {
        // Fallback mock insertion
        const mock: SupabaseSlot = {
          id: `mock-slot-${Date.now()}`,
          counselor_id: currentUserId,
          day_of_week: activeDay,
          time_slot: selectedTime,
        };
        setSlots((prev) => [...prev, mock]);
      }
    } catch (err: any) {
      Alert.alert('Add Failed', err.message || 'Could not add slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSliderPress = (e: any) => {
    const touchX = e.nativeEvent.locationX;
    const percentage = touchX / sliderWidth;
    const index = Math.round(percentage * (timeOptions.length - 1));
    const clampedIndex = Math.max(0, Math.min(timeOptions.length - 1, index));
    setSliderIndex(clampedIndex);
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 128 },
        ]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>Availability Planner</Text>
            <Text style={[styles.title, { color: theme.text }]}>Manage Schedule</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Configure your active workday, allocate slots, and manage booking rules.
            </Text>
          </View>

          {/* Workdays setup */}
          <Card variant="raised" padding="four">
            <SectionHeader title="Active Workday" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
              {days.map((day) => {
                const isActive = activeDay === day;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setActiveDay(day)}
                    style={[
                      styles.dayButton,
                      { borderColor: theme.border, backgroundColor: theme.surfaceSoft },
                      isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}>
                    <Text style={[styles.dayText, { color: isActive ? '#FFFFFF' : theme.text }]}>
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>

          {/* Time Slots allocation */}
          <Card variant="raised" padding="four" style={styles.slotsCard}>
            <SectionHeader title={`Availability Slots (${activeDay})`} />
            
            {loading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: Spacing.four }} />
            ) : (
              <View style={styles.slotsList}>
                {slots
                  .filter((s) => s.day_of_week === activeDay)
                  .map((slot) => (
                    <View key={slot.id} style={[styles.slotItem, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
                      <View style={styles.slotDetails}>
                        <MaterialCommunityIcons name="clock-outline" size={18} color={theme.primary} />
                        <Text style={[styles.slotText, { color: theme.text }]}>{slot.time_slot}</Text>
                      </View>
                      <Pressable onPress={() => handleDeleteSlot(slot.id)} style={styles.deleteBtn}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}
                {slots.filter((s) => s.day_of_week === activeDay).length === 0 && (
                  <Text style={[styles.emptySlotText, { color: theme.textSecondary }]}>
                    No availability slots allocated for this day.
                  </Text>
                )}
              </View>
            )}

            {/* Visual Time Slider component replacement */}
            <View style={[styles.sliderCard, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>Drag or tap track to adjust time</Text>
                <Text style={[styles.sliderValue, { color: theme.primary }]}>{timeOptions[sliderIndex]}</Text>
              </View>

              <View style={styles.sliderTrackWrapper}>
                <Pressable
                  style={styles.sliderTrackPressable}
                  onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                  onPress={handleSliderPress}>
                  {/* Track Background */}
                  <View style={[styles.sliderTrackBackground, { backgroundColor: theme.border }]} />
                  {/* Active segment highlighting */}
                  <View
                    style={[
                      styles.sliderTrackActive,
                      {
                        backgroundColor: theme.primary,
                        width: `${(sliderIndex / (timeOptions.length - 1)) * 100}%`,
                      },
                    ]}
                  />
                  {/* Handle circle knob */}
                  <View
                    style={[
                      styles.sliderKnob,
                      {
                        backgroundColor: theme.primary,
                        left: `${(sliderIndex / (timeOptions.length - 1)) * 100}%`,
                      },
                    ]}
                  />
                </Pressable>
              </View>

              <View style={styles.ticksRow}>
                <Pressable onPress={() => setSliderIndex(0)}><Text style={[styles.tickText, { color: theme.textSecondary }]}>8 AM</Text></Pressable>
                <Pressable onPress={() => setSliderIndex(4)}><Text style={[styles.tickText, { color: theme.textSecondary }]}>10 AM</Text></Pressable>
                <Pressable onPress={() => setSliderIndex(8)}><Text style={[styles.tickText, { color: theme.textSecondary }]}>12 PM</Text></Pressable>
                <Pressable onPress={() => setSliderIndex(12)}><Text style={[styles.tickText, { color: theme.textSecondary }]}>2 PM</Text></Pressable>
                <Pressable onPress={() => setSliderIndex(16)}><Text style={[styles.tickText, { color: theme.textSecondary }]}>4 PM</Text></Pressable>
                <Pressable onPress={() => setSliderIndex(20)}><Text style={[styles.tickText, { color: theme.textSecondary }]}>6 PM</Text></Pressable>
              </View>

              {/* Adjust steps button triggers */}
              <View style={styles.adjustRow}>
                <Pressable
                  disabled={sliderIndex === 0}
                  onPress={() => setSliderIndex((prev) => Math.max(0, prev - 1))}
                  style={[styles.adjustBtn, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }, sliderIndex === 0 && { opacity: 0.3 }]}>
                  <MaterialCommunityIcons name="chevron-left" size={20} color={theme.primary} />
                </Pressable>
                <Text style={[styles.adjustLabel, { color: theme.text }]}>Step 30m</Text>
                <Pressable
                  disabled={sliderIndex === timeOptions.length - 1}
                  onPress={() => setSliderIndex((prev) => Math.min(timeOptions.length - 1, prev + 1))}
                  style={[styles.adjustBtn, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }, sliderIndex === timeOptions.length - 1 && { opacity: 0.3 }]}>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.primary} />
                </Pressable>
              </View>
            </View>

            <Button
              label={submitting ? 'Allocating...' : 'Allocate Selected Time'}
              disabled={submitting}
              variant="primary"
              onPress={handleAddSlot}
              style={{ marginTop: Spacing.one }}
            />
          </Card>

          {/* Booking settings switches */}
          <Card variant="raised" padding="four" style={styles.slotsCard}>
            <SectionHeader title="Consultation Booking Policies" />
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Auto-accept sessions</Text>
                <Text style={[styles.settingBody, { color: theme.textSecondary }]}>
                  Automatically approve incoming bookings without manual review.
                </Text>
              </View>
              <Switch
                value={autoAccept}
                onValueChange={setAutoAccept}
                trackColor={{ true: theme.primary }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Manual review on exams</Text>
                <Text style={[styles.settingBody, { color: theme.textSecondary }]}>
                  Force manual booking verification for students during university exam periods.
                </Text>
              </View>
              <Switch
                value={requireManualReview}
                onValueChange={setRequireManualReview}
                trackColor={{ true: theme.primary }}
              />
            </View>
          </Card>
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
  daysRow: {
    gap: Spacing.two,
    paddingVertical: 4,
  },
  dayButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  slotsCard: {
    gap: Spacing.three,
  },
  slotsList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  slotDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slotText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  deleteBtn: {
    padding: 6,
  },
  emptySlotText: {
    fontSize: FontSize.caption + 1,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: Spacing.two,
  },
  sliderCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  sliderValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  sliderTrackWrapper: {
    height: 36,
    justifyContent: 'center',
  },
  sliderTrackPressable: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrackBackground: {
    height: 6,
    borderRadius: 3,
    width: '100%',
  },
  sliderTrackActive: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
  },
  sliderKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -12 }],
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tickText: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  settingText: {
    flex: 1,
    gap: 2,
    marginRight: Spacing.two,
  },
  settingTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  settingBody: {
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
});
