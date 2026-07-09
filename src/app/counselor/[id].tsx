import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, SectionHeader, Tag } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { fetchCounselorDetail, fetchOrCreateChat, SupabaseCounselor } from '@/lib/supabase-db';
import { getCounselorPhoto } from '../(tabs)/sessions';

export default function CounselorDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: counselorId } = useLocalSearchParams<{ id: string }>();

  const [counselor, setCounselor] = useState<SupabaseCounselor | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const loadCounselorData = async () => {
    if (!counselorId) return;
    try {
      const data = await fetchCounselorDetail(counselorId);
      setCounselor(data);
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

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!counselor) {
    return (
      <View style={[styles.errorScreen, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>Counselor details not found.</Text>
        <Button label="Go back" onPress={() => router.back()} style={{ marginTop: Spacing.two }} />
      </View>
    );
  }

  const name = counselor.profile?.name || 'Counselor';
  const specialtiesText = counselor.specialties.join(', ') || 'General Support';
  const imgUrl = getCounselorPhoto(name, counselor.profile?.avatar_url);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header toolbar */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Counselor Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* Profile Card Info */}
        <View style={styles.avatarSection}>
          <View style={styles.imageWrapper}>
            <View style={styles.circularBackdrop} />
            <Image source={{ uri: imgUrl }} style={styles.portraitImg} />
          </View>
          <Text style={[styles.counselorName, { color: theme.text }]}>{name}</Text>
          <Text style={[styles.counselorRole, { color: theme.primary }]}>{specialtiesText}</Text>
          
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={16} color="#FFB000" />
            <Text style={[styles.ratingText, { color: theme.text }]}>{counselor.rating || '5.0'} / 5.0 Rating</Text>
          </View>
        </View>

        {/* Communication Quick Actions */}
        <View style={styles.actionContainer}>
          <Card variant="raised" padding="three" style={styles.actionsCard}>
            <Text style={[styles.actionsTitle, { color: theme.text }]}>Start connection</Text>
            <View style={styles.actionButtonsRow}>
              {/* Chat action */}
              <Pressable onPress={handleStartChat} disabled={chatLoading} style={styles.circleAction}>
                <View style={[styles.circleIconBox, { backgroundColor: theme.primarySoft }]}>
                  {chatLoading ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <MaterialCommunityIcons name="message-text-outline" size={24} color={theme.primary} />
                  )}
                </View>
                <Text style={[styles.actionLabel, { color: theme.text }]}>Message</Text>
              </Pressable>

              {/* Voice Call action */}
              <Pressable onPress={() => router.push({ pathname: '/video-call', params: { counselorName: name, counselorId: counselor.id, callType: 'voice' } })} style={styles.circleAction}>
                <View style={[styles.circleIconBox, { backgroundColor: theme.primarySoft }]}>
                  <MaterialCommunityIcons name="phone-outline" size={24} color={theme.primary} />
                </View>
                <Text style={[styles.actionLabel, { color: theme.text }]}>Voice Call</Text>
              </Pressable>

              {/* Video Call action */}
              <Pressable onPress={() => router.push({ pathname: '/video-call', params: { counselorName: name, counselorId: counselor.id, callType: 'video' } })} style={styles.circleAction}>
                <View style={[styles.circleIconBox, { backgroundColor: theme.primarySoft }]}>
                  <MaterialCommunityIcons name="video-outline" size={24} color={theme.primary} />
                </View>
                <Text style={[styles.actionLabel, { color: theme.text }]}>Video Call</Text>
              </Pressable>
            </View>
          </Card>
        </View>

        {/* Bio and Note details */}
        <View style={styles.detailsContainer}>
          <SectionHeader title="Biography" />
          <Card variant="surface" padding="three">
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
              {counselor.bio || `${name} is an experienced wellness coach and psychological advisor at KNUST. Dedicated to providing supportive counseling for students dealing with anxiety, academic pressure, and life changes.`}
            </Text>
          </Card>

          {counselor.note && (
            <>
              <SectionHeader title="Counseling Focus" />
              <Card variant="surface" padding="three">
                <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{counselor.note}</Text>
              </Card>
            </>
          )}

          <SectionHeader title="Specialties" />
          <View style={styles.specialtiesWrapper}>
            {counselor.specialties.map((spec, index) => (
              <Tag key={index} label={spec} active />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Persistent Bottom Action Booking Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
        <Button
          label="Book Appointment"
          variant="primary"
          onPress={() => router.push({
            pathname: '/booking/[counselor]',
            params: { counselor: counselor.id }
          })}
          style={styles.bookButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backButton: {
    marginLeft: -Spacing.one,
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: 8,
  },
  imageWrapper: {
    width: 140,
    height: 180,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  circularBackdrop: {
    position: 'absolute',
    bottom: 0,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#8B1C28', // Matching the carousel card background maroon style
    opacity: 0.1,
  },
  portraitImg: {
    width: 120,
    height: 160,
    borderRadius: 60,
    resizeMode: 'cover',
  },
  counselorName: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.two,
  },
  counselorRole: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.semibold,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.semibold,
  },
  actionContainer: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  actionsCard: {
    gap: Spacing.three,
    borderRadius: BorderRadius.md + 4,
  },
  actionsTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  circleAction: {
    alignItems: 'center',
    gap: 6,
  },
  circleIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  detailsContainer: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  bodyText: {
    fontSize: FontSize.body - 2,
    lineHeight: 22,
  },
  specialtiesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  bookButton: {
    height: Size.buttonHeight,
    borderRadius: BorderRadius.full,
  },
});
