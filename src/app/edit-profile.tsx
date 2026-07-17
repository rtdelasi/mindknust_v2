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
import * as ImagePicker from 'expo-image-picker';

import { Avatar, Button, Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { upsertProfile, updateCounselorMetadata, fetchCounselors } from '@/lib/supabase-db';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { getPublicUrl, uploadFile } from '@/lib/supabase-storage';

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, userName, avatarUrl, updateProfile } = useMockAuth();

  const [name, setName] = useState(userName);
  const [photoUri, setPhotoUri] = useState<string | null>(avatarUrl);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Counselor specific states
  const [specialties, setSpecialties] = useState('');
  const [note, setNote] = useState('');
  const [bio, setBio] = useState('');

  const isCounselor = role === 'counselor';

  useEffect(() => {
    setName(userName);
    setPhotoUri(avatarUrl);
  }, [userName, avatarUrl]);

  useEffect(() => {
    async function loadProfileAndMetadata() {
      const activeUserUid = auth?.currentUser?.uid || (isCounselor ? 'kwame-boateng' : 'student-user');
      setFetching(true);
      try {
        // 1. Fetch main profile data (for Name and Avatar URL) from Supabase
        if (hasSupabaseConfig && supabase) {
          const { data, error } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', activeUserUid)
            .maybeSingle();
          if (!error && data) {
            if (data.name) setName(data.name);
            if (data.avatar_url) setPhotoUri(data.avatar_url);
          }
        }

        // 2. Fetch Counselor metadata
        if (isCounselor && hasSupabaseConfig) {
          const counselorsList = await fetchCounselors();
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
        }
      } catch (err) {
        console.warn('Could not fetch profile metadata from database:', err);
      } finally {
        setFetching(false);
      }
    }
    loadProfileAndMetadata();
  }, [isCounselor]);

  const handleSelectPhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is required to update your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera access is required to take a profile photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleEditPhoto = () => {
    Alert.alert(
      'Profile Photo',
      'Select a source to upload your profile picture:',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handleSelectPhoto },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }

    setLoading(true);
    try {
      const activeUserUid = auth?.currentUser?.uid || (isCounselor ? 'kwame-boateng' : 'student-user');
      const activeUserEmail = auth?.currentUser?.email || (isCounselor ? 'kwame@counselcare.edu' : 'student@knust.edu');

      let finalAvatarUrl = photoUri;

      // Upload profile image to Supabase storage if it is a local path
      if (photoUri && !photoUri.startsWith('http') && hasSupabaseConfig) {
        try {
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const filename = `avatars/${activeUserUid}/${Date.now()}.jpg`;
          await uploadFile('social-media', filename, blob, blob.type || 'image/jpeg');
          finalAvatarUrl = getPublicUrl('social-media', filename);
        } catch (uploadErr) {
          console.warn('Storage image upload failed, using local URI fallback:', uploadErr);
        }
      }

      // 1. Update local mock store cache
      await updateProfile(name.trim(), finalAvatarUrl);

      // 2. Sync to Firebase display profile if active
      if (hasFirebaseConfig && auth && auth.currentUser) {
        await firebaseUpdateProfile(auth.currentUser, { 
          displayName: name.trim(),
          photoURL: finalAvatarUrl || undefined
        });
      }

      // 3. Sync to Supabase profiles database table
      if (hasSupabaseConfig) {
        await upsertProfile(activeUserUid, name.trim(), activeUserEmail, role || 'student', finalAvatarUrl || undefined);

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
            
            {/* Profile Photo Editor Section */}
            <View style={styles.avatarSection}>
              <Pressable onPress={handleEditPhoto} style={styles.avatarPressable}>
                <Avatar
                  name={name || 'User'}
                  size="lg"
                  source={photoUri ? { uri: photoUri } : undefined}
                />
                <View style={[styles.editIconBadge, { backgroundColor: theme.primary }]}>
                  <MaterialCommunityIcons name="camera" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
              <Text style={[styles.avatarTip, { color: theme.textSecondary }]}>
                Tap to update profile photo
              </Text>
            </View>

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
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.three,
    gap: Spacing.two,
  },
  avatarPressable: {
    position: 'relative',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarTip: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.one,
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
