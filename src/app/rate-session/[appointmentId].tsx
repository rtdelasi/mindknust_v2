import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  fetchAppointmentById,
  hasReviewedAppointment,
  submitCounselorReview,
  SupabaseAppointment,
} from '@/lib/supabase-db';
import { parseAppointmentTopic } from '@/lib/counselor-utils';

export default function RateSessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const { anonymousId } = useMockAuth();

  const [appointment, setAppointment] = useState<SupabaseAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  useEffect(() => {
    (async () => {
      if (!appointmentId) return;
      try {
        const [appt, reviewed] = await Promise.all([
          fetchAppointmentById(appointmentId),
          hasReviewedAppointment(appointmentId),
        ]);

        setAppointment(appt);
        setAlreadyReviewed(reviewed);
      } catch (err) {
        console.warn('[Rating] Error loading appointment:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [appointmentId]);

  const handleSubmit = async () => {
    if (!appointment || !appointmentId) return;
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setSubmitting(true);
    const result = await submitCounselorReview(
      appointmentId,
      appointment.counselor_id,
      currentUserId,
      rating,
      comment.trim() || undefined,
      isAnonymous
    );

    setSubmitting(false);

    if (result.ok) {
      Alert.alert(
        'Thank You!',
        'Your rating has been recorded. It helps other students choose the right counselor.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else if (result.alreadyReviewed) {
      Alert.alert('Already Rated', 'You have already rated this session.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Could not submit your rating right now.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>Session not found</Text>
          <Button label="Go back" onPress={() => router.back()} style={{ marginTop: Spacing.three }} />
        </View>
      </View>
    );
  }

  if (alreadyReviewed) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="check-circle-outline" size={48} color={theme.success} />
          <Text style={[styles.errorText, { color: theme.text }]}>Already Rated</Text>
          <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
            You have already submitted a rating for this session.
          </Text>
          <Button label="Go back" onPress={() => router.back()} style={{ marginTop: Spacing.three }} />
        </View>
      </View>
    );
  }

  const counselorName = appointment.counselor_profile?.name || 'Counselor';
  const dateStr = new Date(appointment.appointment_date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Back button */}
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surfaceRaised }]}
            onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.text} />
          </Pressable>

          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>SESSION FEEDBACK</Text>
            <Text style={[styles.title, { color: theme.text }]}>Rate your experience</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Help future students by sharing how this session went.
            </Text>
          </View>

          {/* Session Summary Card */}
          <Card variant="surface" padding="four">
            <View style={styles.summaryRow}>
              <Avatar name={counselorName} size="lg" />
              <View style={styles.summaryText}>
                <Text style={[styles.counselorName, { color: theme.text }]}>{counselorName}</Text>
                <Text style={[styles.sessionDate, { color: theme.textSecondary }]}>{dateStr}</Text>
                <Text style={[styles.sessionTopic, { color: theme.textSecondary }]}>
                  {parseAppointmentTopic(appointment.topic).cleanTopic || 'General Counseling'} ({parseAppointmentTopic(appointment.topic).sessionType === 'in-person' ? 'In-Person' : 'Online'})
                </Text>
              </View>
            </View>
          </Card>

          {/* Star Rating */}
          <Card variant="surface" padding="four">
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Rating</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= rating;
                return (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}>
                    <MaterialCommunityIcons
                      name={isActive ? 'star' : 'star-outline'}
                      size={48}
                      color={isActive ? '#FFB000' : theme.border}
                    />
                  </Pressable>
                );
              })}
            </View>
            {rating > 0 && (
              <Text style={[styles.ratingLabel, { color: theme.textSecondary }]}>
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </Text>
            )}
          </Card>

          {/* Comment (optional) */}
          <Card variant="surface" padding="four">
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Comment <Text style={{ color: theme.textSecondary }}>(optional)</Text>
            </Text>
            <TextInput
              style={[
                styles.commentInput,
                { backgroundColor: theme.surfaceSoft, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Share what was helpful or could be improved..."
              placeholderTextColor={theme.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: theme.textSecondary }]}>
              {comment.length} / 500
            </Text>
          </Card>

          {/* Anonymity toggle */}
          {anonymousId && (
            <Card variant="surface" padding="four">
              <View style={styles.anonRow}>
                <View style={styles.anonInfo}>
                  <MaterialCommunityIcons name="incognito" size={22} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.anonLabel, { color: theme.text }]}>
                      Post review anonymously
                    </Text>
                    <Text style={[styles.anonHint, { color: theme.textSecondary }]}>
                      Your counselor always sees your identity. Only other students see your
                      anonymous ID.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isAnonymous}
                  onValueChange={setIsAnonymous}
                  trackColor={{ false: theme.surfaceSoft, true: `${theme.primary}40` }}
                  thumbColor={isAnonymous ? theme.primary : theme.surfaceRaised}
                />
              </View>
            </Card>
          )}

          <Button
            label={submitting ? 'Submitting...' : 'Submit Rating'}
            disabled={submitting || rating === 0}
            onPress={handleSubmit}
            style={{ marginTop: Spacing.two }}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  errorText: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  errorSubtext: {
    fontSize: FontSize.body - 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
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
    gap: 3,
  },
  counselorName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  sessionDate: {
    fontSize: FontSize.caption + 1,
  },
  sessionTopic: {
    fontSize: FontSize.caption,
  },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.two,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  starButton: {
    padding: Spacing.one,
  },
  ratingLabel: {
    fontSize: FontSize.body - 1,
    textAlign: 'center',
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.one,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    fontSize: FontSize.body - 1,
    minHeight: 100,
  },
  charCount: {
    fontSize: FontSize.small,
    textAlign: 'right',
    marginTop: Spacing.one,
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
});
