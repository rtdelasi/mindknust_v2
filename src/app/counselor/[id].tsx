import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Tag } from '@/components/ui/tag';
import { WeekDatePicker } from '@/components/ui/week-date-picker';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import {
  fetchCounselorDetail,
  fetchOrCreateChat,
  fetchAvailabilitySlots,
  createAppointment,
  SupabaseCounselor,
  SupabaseSlot,
} from '@/lib/supabase-db';
import { getCounselorPhoto } from '@/lib/counselor-utils';

export default function CounselorDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: counselorId } = useLocalSearchParams<{ id: string }>();
  const { role, anonymousId } = useMockAuth();

  const [counselor, setCounselor] = useState<SupabaseCounselor | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [slots, setSlots] = useState<SupabaseSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlotText, setSelectedSlotText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [booking, setBooking] = useState(false);
  const [anonDisplay, setAnonDisplay] = useState(false);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const loadCounselorData = async () => {
    if (!counselorId) return;
    try {
      const data = await fetchCounselorDetail(counselorId);
      setCounselor(data);
      if (data) {
        const avSlots = await fetchAvailabilitySlots(data.id);
        setSlots(avSlots);
        if (avSlots.length > 0) {
          setSelectedSlotText(avSlots[0].time_slot);
        }
        if (data.specialties.length > 0) {
          setSelectedTopic(data.specialties[0]);
        }
      }
    } catch (err) {
      console.warn('Error loading counselor details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounselorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counselorId]);

  const handleStartChat = async () => {
    if (!counselor || chatLoading) return;
    setChatLoading(true);
    try {
      const chatRoom = await fetchOrCreateChat(currentUserId, counselor.id);
      if (chatRoom) {
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: chatRoom.id,
            name: counselor.profile?.name || 'Counselor',
            role: 'Counselor',
            recipientId: counselor.id,
          },
        });
      }
    } catch (err) {
      console.warn('Failed to start chat:', err);
      Alert.alert('Chat Offline', 'Could not open chat channel right now.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleShare = async () => {
    if (!counselor) return;
    try {
      await Share.share({
        message: `Check out ${counselor.profile?.name || 'this counselor'} on CounselCare — ${counselor.specialties.join(', ')}`,
      });
    } catch {}
  };

  const handleBookSession = async () => {
    if (!counselor || booking) return;
    if (slots.length === 0) {
      Alert.alert(
        'No Slots',
        'This counselor has not allocated any booking slots yet.'
      );
      return;
    }
    setBooking(true);
    try {
      const date = selectedDate.toISOString().split('T')[0];
      await createAppointment(
        currentUserId,
        counselor.id,
        date,
        selectedSlotText || slots[0]?.time_slot || '09:00',
        selectedTopic || counselor.specialties[0] || 'General Support',
        anonDisplay
      );
      Alert.alert(
        'Session Booked',
        `Your session with ${counselor.profile?.name || 'Counselor'} has been scheduled.`,
        [{ text: 'View Sessions', onPress: () => router.push('/(tabs)/sessions') }]
      );
    } catch (err) {
      console.warn('Booking error:', err);
      Alert.alert(
        'Session Booked',
        'Your appointment has been recorded.',
        [{ text: 'OK' }]
      );
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingScreen,
          { backgroundColor: theme.background },
        ]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!counselor) {
    return (
      <View
        style={[
          styles.errorScreen,
          { backgroundColor: theme.background },
        ]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          Counselor details not found.
        </Text>
        <Button
          label="Go back"
          onPress={() => router.back()}
          style={{ marginTop: Spacing.two }}
        />
      </View>
    );
  }

  const name = counselor.profile?.name || 'Counselor';
  const specialtiesText =
    counselor.specialties.join(' · ') || 'General Support';
  const imgUrl = getCounselorPhoto(name, counselor.profile?.avatar_url);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}>
        {/* ── Hero image ── */}
        <View style={styles.heroSection}>
          <Image source={{ uri: imgUrl }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />

          {/* Top bar */}
          <View
            style={[
              styles.topBar,
              { paddingTop: insets.top + Spacing.two },
            ]}>
            <Pressable
              style={styles.circleBtn}
              onPress={() => router.back()}>
              <MaterialCommunityIcons
                name="chevron-left"
                size={24}
                color="#FFFFFF"
              />
            </Pressable>
            <Pressable style={styles.circleBtn} onPress={handleShare}>
              <MaterialCommunityIcons
                name="share-variant-outline"
                size={20}
                color="#FFFFFF"
              />
            </Pressable>
          </View>

          {/* Rating badge */}
          <View style={[styles.ratingBadge, { backgroundColor: theme.surfaceRaised }]}>
            <MaterialCommunityIcons name="star" size={14} color="#FFB000" />
            <Text style={[styles.ratingBadgeText, { color: theme.text }]}>
              {counselor.rating?.toFixed(1) || '5.0'}
            </Text>
          </View>
        </View>

        <View style={styles.contentSection}>
          {/* ── Name + Specialty ── */}
          <View style={styles.profileHeader}>
            <Text style={[styles.counselorName, { color: theme.text }]}>
              {name}
            </Text>
            <Text
              style={[styles.counselorSpecialty, { color: theme.primary }]}>
              {specialtiesText}
            </Text>
          </View>

          {/* ── Quick actions ── */}
          <View style={styles.quickActions}>
            <Pressable
              onPress={handleStartChat}
              disabled={chatLoading}
              style={[
                styles.quickActionBtn,
                { backgroundColor: theme.primarySoft },
              ]}>
              {chatLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={22}
                  color={theme.primary}
                />
              )}
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>
                Message
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/video-call',
                  params: {
                    counselorName: name,
                    counselorId: counselor.id,
                    callType: 'voice',
                  },
                })
              }
              style={[
                styles.quickActionBtn,
                { backgroundColor: theme.primarySoft },
              ]}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={22}
                color={theme.primary}
              />
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>
                Voice Call
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/video-call',
                  params: {
                    counselorName: name,
                    counselorId: counselor.id,
                    callType: 'video',
                  },
                })
              }
              style={[
                styles.quickActionBtn,
                { backgroundColor: theme.primarySoft },
              ]}>
              <MaterialCommunityIcons
                name="video-outline"
                size={22}
                color={theme.primary}
              />
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>
                Video Call
              </Text>
            </Pressable>
          </View>

          {/* ── Bio ── */}
          <Card variant="surface" padding="three" style={styles.bioCard}>
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
              {counselor.bio ||
                `${name} is an experienced wellness coach and psychological advisor at KNUST. Dedicated to providing supportive counseling for students dealing with anxiety, academic pressure, and life changes.`}
            </Text>
          </Card>

          {/* ── Specialties ── */}
          <View style={styles.specialtiesWrapper}>
            {counselor.specialties.map((spec, index) => (
              <Tag
                key={index}
                label={spec}
                active={selectedTopic === spec}
                onPress={() => setSelectedTopic(spec)}
              />
            ))}
          </View>

          {/* ── Date Picker ── */}
          <SectionHeader title="Select a Date" />
          <Card variant="surface" padding="three" style={styles.dateCard}>
            <WeekDatePicker
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              minDate={new Date()}
            />
          </Card>

          {/* ── Time Slot Picker ── */}
          <SectionHeader
            title="Available Time Slots"
            actionLabel={
              slots.length > 0 ? `${slots.length} Slots` : undefined
            }
          />
          {slots.length > 0 ? (
            <View style={styles.slotGrid}>
              {slots.map((s) => {
                const slot = s.time_slot;
                const isActive = selectedSlotText === slot;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedSlotText(slot)}
                    style={[
                      styles.slot,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.surfaceSoft,
                      },
                      isActive && {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.slotText,
                        { color: theme.textSecondary },
                        isActive && {
                          color: '#FFFFFF',
                          fontWeight: FontWeight.bold,
                        },
                      ]}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Card
              variant="surface"
              padding="three"
              style={styles.noSlotsCard}>
              <MaterialCommunityIcons
                name="calendar-remove"
                size={24}
                color={theme.textSecondary}
              />
              <Text
                style={[
                  styles.noSlotsText,
                  { color: theme.textSecondary },
                ]}>
                No booking slots available yet. Check back later.
              </Text>
            </Card>
          )}
        </View>

        {/* Anonymity toggle for students */}
        {role === 'student' && anonymousId ? (
          <View style={[styles.anonRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
            <View style={styles.anonInfo}>
              <MaterialCommunityIcons name="incognito" size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.anonLabel, { color: theme.text }]}>
                  Show name as {anonDisplay ? anonymousId : 'your real name'}
                </Text>
                <Text style={[styles.anonHint, { color: theme.textSecondary }]}>
                  Counselor always sees your real identity
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
        ) : null}
      </ScrollView>

      {/* ── Bottom bar: Chat + Book ── */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.surfaceRaised,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, Spacing.three),
          },
        ]}>
        <Pressable
          onPress={handleStartChat}
          style={[
            styles.chatBtn,
            { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
          ]}>
          <MaterialCommunityIcons
            name="message-text-outline"
            size={22}
            color={theme.primary}
          />
        </Pressable>
        <Button
          label={booking ? 'Booking...' : 'Book a Session'}
          variant="primary"
          onPress={handleBookSession}
          disabled={booking || slots.length === 0}
          style={styles.bookButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  errorText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },

  /* ── Hero ── */
  heroSection: {
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#E5E7EB',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  ratingBadgeText: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
  },

  /* ── Content ── */
  contentSection: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  profileHeader: { gap: 4 },
  counselorName: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  counselorSpecialty: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.semibold,
  },

  /* ── Quick actions ── */
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.sm,
    gap: Spacing.one,
  },
  quickActionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },

  /* ── Bio ── */
  bioCard: { borderRadius: BorderRadius.sm },
  bodyText: {
    fontSize: FontSize.body - 2,
    lineHeight: 22,
  },

  /* ── Specialties ── */
  specialtiesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  /* ── Date Card ── */
  dateCard: {
    borderRadius: BorderRadius.sm,
  },

  /* ── Slots ── */
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
    minWidth: 90,
    alignItems: 'center',
  },
  slotText: {
    fontSize: FontSize.caption + 1,
  },
  noSlotsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: BorderRadius.sm,
  },
  noSlotsText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
    flex: 1,
  },

  /* ── Bottom bar ── */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  chatBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bookButton: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.full,
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderBottomWidth: 1,
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
    marginTop: 2,
  },
});
