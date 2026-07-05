import { MaterialCommunityIcons } from '@expo/vector-icons';
import { updateProfile as firebaseUpdateProfile } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { upsertProfile, updateCounselorMetadata, fetchCounselors, hasSupabaseConfig } from '@/lib/supabase-db';

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, userName, updateProfileName } = useMockAuth();

  const [name, setName] = useState(userName);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Counselor specific states
  const [specialties, setSpecialties] = useState('');
  const [note, setNote] = useState('');
  const [bio, setBio] = useState('');

  const isCounselor = role === 'counselor';

  useEffect(() => {
    setName(userName);
  }, [userName]);

  useEffect(() => {
    async function loadCounselorData() {
      if (!isCounselor || !hasSupabaseConfig) return;
      setFetching(true);
      try {
        const counselorsList = await fetchCounselors();
        // Since it's a mock session, we look for 'kwame-boateng' or the matching profile
        const activeUserUid = auth?.currentUser?.uid || 'kwame-boateng';
        const currentCounselor = counselorsList.find(c => c.id === activeUserUid);
        if (currentCounselor) {
          setSpecialties(currentCounselor.specialties.join(', '));
          setNote(currentCounselor.note || '');
          setBio(currentCounselor.bio || '');
        } else {
          // Fallback placeholders for offline/sandbox testing
          setSpecialties('Burnout, Confidence, Personal Growth');
          setNote('Burnout, confidence, and personal growth');
          setBio('Clinical wellness coach specializing in personal growth systems, student motivation, confidence building, and emotional wellbeing.');
        }
      } catch (err) {
        console.warn('Could not fetch counselor metadata from database:', err);
      } finally {
        setFetching(false);
      }
    }
    loadCounselorData();
  }, [isCounselor]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update local mock store cache
      await updateProfileName(name.trim());

      const activeUserUid = auth?.currentUser?.uid || (isCounselor ? 'kwame-boateng' : 'student-user');
      const activeUserEmail = auth?.currentUser?.email || (isCounselor ? 'kwame@counselcare.edu' : 'student@knust.edu');

      // 2. Sync to Firebase display profile if active
      if (hasFirebaseConfig && auth.currentUser) {
        await firebaseUpdateProfile(auth.currentUser, { displayName: name.trim() });
      }

      // 3. Sync to Supabase profiles database table
      if (hasSupabaseConfig) {
        await upsertProfile(activeUserUid, name.trim(), activeUserEmail, role || 'student');

        // 4. Sync counselor metadata properties
        if (isCounselor) {
          const specialtiesArray = specialties
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          await updateCounselorMetadata(activeUserUid, specialtiesArray, note.trim(), bio.trim());
        }
      }

      setLoading(false);
      Alert.alert('Profile Saved', 'Your profile details have been synced successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      Alert.alert('Save Failed', err.message || 'An error occurred while updating your profile.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
        </View>
      </View>

      {fetching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading profile metadata...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.formContainer, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Card variant="surface" padding="four" style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Details</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
              <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name..."
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.textInput, { color: theme.text }]}
                />
              </View>
            </View>

            {/* Counselor Specific Fields */}
            {isCounselor ? (
              <View style={styles.counselorFields}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Tagline / Short Note</Text>
                  <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="e.g. Stress, routine coaching, & wellness"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.textInput, { color: theme.text }]}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Specialties (comma-separated)</Text>
                  <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
                    <TextInput
                      value={specialties}
                      onChangeText={setSpecialties}
                      placeholder="e.g. Stress, Anxiety, Relationships"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.textInput, { color: theme.text }]}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Clinical Biography</Text>
                  <View style={[styles.textAreaWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
                    <TextInput
                      value={bio}
                      onChangeText={setBio}
                      placeholder="Tell students about your qualifications and coaching methods..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={4}
                      style={[styles.textArea, { color: theme.text }]}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            <Button
              label={loading ? "Saving Changes..." : "Save Changes"}
              variant="primary"
              onPress={handleSave}
              disabled={loading}
              style={{ marginTop: Spacing.two }}
            />
          </Card>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    ...Shadows.light.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  backButton: {
    marginLeft: -Spacing.one,
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: FontSize.caption + 1,
  },
  formContainer: {
    padding: Spacing.three,
  },
  formCard: {
    gap: Spacing.four,
  },
  sectionTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.one,
  },
  inputGroup: {
    gap: Spacing.two,
  },
  label: {
    fontSize: FontSize.small + 1,
    fontWeight: FontWeight.semibold,
  },
  inputWrapper: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 100,
  },
  textInput: {
    fontSize: FontSize.body - 1,
    paddingVertical: 0,
  },
  textArea: {
    fontSize: FontSize.body - 1,
    textAlignVertical: 'top',
  },
  counselorFields: {
    gap: Spacing.four,
  },
});
