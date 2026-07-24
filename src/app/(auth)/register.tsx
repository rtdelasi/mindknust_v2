import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BorderRadius, FontSize, FontWeight, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMockAuth } from '@/lib/mock-auth-store';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import {
  upsertProfile,
  generateAnonymousId,
  createStudentProfile,
  createCounselorProfile,
} from '@/lib/supabase-db';

const SPECIALIZATION_OPTIONS = [
  'Academic Stress',
  'Anxiety',
  'Depression',
  'Relationship Issues',
  'Grief & Loss',
  'Family Issues',
  'Substance Use',
  'General Wellbeing',
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useMockAuth();

  // Role toggle
  const [role, setRole] = useState<'student' | 'counselor'>('student');

  // Common fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Student Step 2 fields
  const [studentStep, setStudentStep] = useState<1 | 2>(1);
  const [generatedAnonId, setGeneratedAnonId] = useState<string>('');
  const [showAnonModal, setShowAnonModal] = useState(false);
  const [createdStudentUid, setCreatedStudentUid] = useState<string>('');
  const [studentIndex, setStudentIndex] = useState('');
  const [program, setProgram] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState<number>(1);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Counselor Multi-step fields
  const [counselorStep, setCounselorStep] = useState<1 | 2 | 3>(1);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [qualification, setQualification] = useState('');
  const [credentialDoc, setCredentialDoc] = useState<string | null>(null);
  const [specializations, setSpecializations] = useState<string[]>(['Academic Stress', 'General Wellbeing']);
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([DAYS_OF_WEEK[0]]);
  const workTimeStart = '09:00 AM';
  const workTimeEnd = '05:00 PM';

  // Helper for picking images
  const pickImage = async (type: 'doc' | 'photo') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        if (type === 'doc') {
          setCredentialDoc(result.assets[0].uri);
        } else {
          setPhotoUrl(result.assets[0].uri);
        }
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  };

  // Toggle specialization pills
  const toggleSpecialization = (spec: string) => {
    if (specializations.includes(spec)) {
      setSpecializations(specializations.filter((s) => s !== spec));
    } else {
      setSpecializations([...specializations, spec]);
    }
  };

  // Toggle day selection
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // ----------------------------------------------------
  // STUDENT SIGNUP SUBMISSION
  // ----------------------------------------------------
  const handleStudentStep1 = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const anonId = generateAnonymousId();
      setGeneratedAnonId(anonId);

      let userUid = `student-${Date.now()}`;

      if (hasFirebaseConfig && auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCredential.user, { displayName: name.trim() });
        userUid = userCredential.user.uid;
      }

      setCreatedStudentUid(userUid);

      // Save to Supabase DB profiles
      await upsertProfile(userUid, name.trim(), email.trim(), 'student', undefined, anonId);

      // Create base student profile
      await createStudentProfile({ userId: userUid });

      // Save state to local auth
      await login('student', email.trim(), name.trim(), undefined, anonId);

      setLoading(false);
      setShowAnonModal(true);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to create student account.');
    }
  };

  const handleFinishStudentStep2 = async (skip: boolean) => {
    setShowAnonModal(false);
    if (!skip && createdStudentUid) {
      try {
        await createStudentProfile({
          userId: createdStudentUid,
          studentIndexNumber: studentIndex,
          program,
          yearOfStudy,
          emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone,
        });
      } catch (e) {
        console.warn('Error saving additional student details:', e);
      }
    }
    router.replace('/');
  };

  // ----------------------------------------------------
  // COUNSELOR APPLICATION SUBMISSION
  // ----------------------------------------------------
  const handleCounselorSubmit = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Please complete basic details in Step 1.');
      setCounselorStep(1);
      return;
    }
    if (!licenseNumber.trim() || !qualification.trim()) {
      setError('Please complete credential details in Step 2.');
      setCounselorStep(2);
      return;
    }

    setError('');
    setLoading(true);

    try {
      let userUid = `counselor-${Date.now()}`;

      if (hasFirebaseConfig && auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCredential.user, { displayName: name.trim() });
        userUid = userCredential.user.uid;
      }

      const availabilityData = selectedDays.map((day) => ({
        day,
        start: workTimeStart,
        end: workTimeEnd,
      }));

      // Upsert profile as counselor
      await upsertProfile(userUid, name.trim(), email.trim(), 'counselor', photoUrl || undefined);

      // Save full counselor profile application (status = pending)
      await createCounselorProfile({
        userId: userUid,
        licenseNumber: licenseNumber.trim(),
        qualification: qualification.trim(),
        credentialDocumentUrl: credentialDoc || undefined,
        specializations,
        bio: bio.trim(),
        photoUrl: photoUrl || undefined,
        availability: availabilityData,
      });

      // Update mock auth with pending status
      await login('counselor', email.trim(), name.trim(), photoUrl || undefined, undefined, 'pending');

      setLoading(false);
      router.replace('/counselor-pending');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to submit counselor application.');
    }
  };

  // Is KNUST email
  const isKnustEmail = email.trim().toLowerCase().endsWith('@knust.edu.gh');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Top Segmented Role Toggle */}
          <View style={[styles.roleSegmentWrapper, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
            <Pressable
              onPress={() => {
                setRole('student');
                setError('');
              }}
              style={[
                styles.roleSegmentBtn,
                role === 'student' && { backgroundColor: theme.primary },
              ]}>
              <MaterialCommunityIcons
                name="school"
                size={18}
                color={role === 'student' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text style={[styles.roleSegmentLabel, { color: role === 'student' ? '#FFFFFF' : theme.textSecondary }]}>
                {"I'm a Student"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setRole('counselor');
                setError('');
              }}
              style={[
                styles.roleSegmentBtn,
                role === 'counselor' && { backgroundColor: theme.primary },
              ]}>
              <MaterialCommunityIcons
                name="doctor"
                size={18}
                color={role === 'counselor' ? '#FFFFFF' : theme.textSecondary}
              />
              <Text style={[styles.roleSegmentLabel, { color: role === 'counselor' ? '#FFFFFF' : theme.textSecondary }]}>
                {"I'm a Counselor"}
              </Text>
            </Pressable>
          </View>

          {/* Header text */}
          <View style={styles.headerBlock}>
            <Text style={[styles.title, { color: theme.text }]}>
              {role === 'student' ? 'Student Registration' : 'Counselor Application'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {role === 'student'
                ? 'Join KNUST CounselCare for instant confidential support'
                : 'Apply to join our verified clinical counseling portal'}
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.surfaceSoft, borderColor: '#EF4444' }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ════════════════════════════════════════════════════ */}
          {/* STUDENT FORM */}
          {/* ════════════════════════════════════════════════════ */}
          {role === 'student' && (
            <Card variant="raised" padding="four" style={styles.card}>
              {studentStep === 1 ? (
                <>
                  <Text style={[styles.stepTitle, { color: theme.primary }]}>Step 1: Account Credentials</Text>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name *</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="account-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="e.g. Kwame Mensah"
                        placeholderTextColor={theme.textSecondary}
                        value={name}
                        onChangeText={setName}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <View style={styles.labelWithBadgeRow}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address *</Text>
                      {email.length > 3 && (
                        <Text style={[styles.emailBadge, { color: isKnustEmail ? '#10B981' : theme.textSecondary }]}>
                          {isKnustEmail ? '✓ Valid KNUST Email' : 'Standard Email'}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="email-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="student@knust.edu.gh"
                        placeholderTextColor={theme.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Password *</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="lock-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="••••••••"
                        placeholderTextColor={theme.textSecondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <Button
                    label={loading ? 'Creating Account...' : 'Register Student Account'}
                    onPress={handleStudentStep1}
                    disabled={loading}
                    style={styles.actionBtn}
                  />
                </>
              ) : (
                <>
                  <View style={styles.stepHeaderRow}>
                    <Text style={[styles.stepTitle, { color: theme.primary }]}>Step 2: Profile Completion</Text>
                    <Text style={[styles.optionalBadge, { color: theme.textSecondary }]}>Optional</Text>
                  </View>
                  <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
                    Help us personalize your wellness experience. You can fill this now or skip.
                  </Text>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>
                      KNUST Student Index Number <Text style={styles.optLabel}>(optional)</Text>
                    </Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="card-account-details-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="e.g. 20847291"
                        placeholderTextColor={theme.textSecondary}
                        value={studentIndex}
                        onChangeText={setStudentIndex}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>
                      Program / Department <Text style={styles.optLabel}>(optional)</Text>
                    </Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="book-education-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="e.g. BSc Computer Science"
                        placeholderTextColor={theme.textSecondary}
                        value={program}
                        onChangeText={setProgram}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Year of Study</Text>
                    <View style={styles.yearPillsRow}>
                      {[1, 2, 3, 4, 5, 6].map((y) => (
                        <Pressable
                          key={y}
                          onPress={() => setYearOfStudy(y)}
                          style={[
                            styles.yearPill,
                            { borderColor: yearOfStudy === y ? theme.primary : theme.border },
                            yearOfStudy === y && { backgroundColor: theme.primarySoft },
                          ]}>
                          <Text style={[styles.yearPillText, { color: yearOfStudy === y ? theme.primary : theme.text }]}>
                            Yr {y}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>
                      Emergency Contact Name <Text style={styles.optLabel}>(optional)</Text>
                    </Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="account-heart-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="Parent / Guardian / Sponsor Name"
                        placeholderTextColor={theme.textSecondary}
                        value={emergencyName}
                        onChangeText={setEmergencyName}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>
                      Emergency Contact Phone <Text style={styles.optLabel}>(optional)</Text>
                    </Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="phone-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="+233 24 000 0000"
                        placeholderTextColor={theme.textSecondary}
                        value={emergencyPhone}
                        onChangeText={setEmergencyPhone}
                        keyboardType="phone-pad"
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={[styles.safetyNoticeBox, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="shield-alert-outline" size={18} color={theme.primary} />
                    <Text style={[styles.safetyNoticeText, { color: theme.textSecondary }]}>
                      Only used if we are seriously concerned about your safety. Never shared casually.
                    </Text>
                  </View>

                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => handleFinishStudentStep2(true)}
                      style={[styles.skipBtn, { borderColor: theme.border }]}>
                      <Text style={[styles.skipBtnText, { color: theme.textSecondary }]}>Skip for now</Text>
                    </Pressable>
                    <Button
                      label="Complete Profile"
                      onPress={() => handleFinishStudentStep2(false)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}
            </Card>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/* COUNSELOR MULTI-STEP APPLICATION FORM */}
          {/* ════════════════════════════════════════════════════ */}
          {role === 'counselor' && (
            <Card variant="raised" padding="four" style={styles.card}>
              {/* Counselor Stepper Bar */}
              <View style={styles.stepperBar}>
                <View style={[styles.stepItem, counselorStep >= 1 && { borderBottomColor: theme.primary }]}>
                  <Text style={[styles.stepItemText, { color: counselorStep >= 1 ? theme.primary : theme.textSecondary }]}>
                    1. Basic
                  </Text>
                </View>
                <View style={[styles.stepItem, counselorStep >= 2 && { borderBottomColor: theme.primary }]}>
                  <Text style={[styles.stepItemText, { color: counselorStep >= 2 ? theme.primary : theme.textSecondary }]}>
                    2. Credentials
                  </Text>
                </View>
                <View style={[styles.stepItem, counselorStep >= 3 && { borderBottomColor: theme.primary }]}>
                  <Text style={[styles.stepItemText, { color: counselorStep >= 3 ? theme.primary : theme.textSecondary }]}>
                    3. Practice
                  </Text>
                </View>
              </View>

              {/* Step 1: Basic Info */}
              {counselorStep === 1 && (
                <>
                  <Text style={[styles.stepTitle, { color: theme.primary }]}>Step 1: Account Information</Text>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name *</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="account-tie-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="Dr. Samuel Boateng"
                        placeholderTextColor={theme.textSecondary}
                        value={name}
                        onChangeText={setName}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Official Email *</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="email-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="counselor@knust.edu.gh"
                        placeholderTextColor={theme.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Password *</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="lock-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="••••••••"
                        placeholderTextColor={theme.textSecondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <Button
                    label="Next: Credentials →"
                    onPress={() => {
                      if (!name.trim() || !email.trim() || !password) {
                        setError('Please complete all basic info fields.');
                        return;
                      }
                      setError('');
                      setCounselorStep(2);
                    }}
                    style={styles.actionBtn}
                  />
                </>
              )}

              {/* Step 2: Credentials */}
              {counselorStep === 2 && (
                <>
                  <Text style={[styles.stepTitle, { color: theme.primary }]}>Step 2: Professional License & Qualification</Text>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>License / Certification Number *</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="certificate-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="e.g. GPC-PSY-2024-884"
                        placeholderTextColor={theme.textSecondary}
                        value={licenseNumber}
                        onChangeText={setLicenseNumber}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Institution / Highest Qualification *</Text>
                    <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <MaterialCommunityIcons name="school-outline" size={20} color={theme.textSecondary} />
                      <TextInput
                        placeholder="e.g. MSc Clinical Psychology, University of Ghana"
                        placeholderTextColor={theme.textSecondary}
                        value={qualification}
                        onChangeText={setQualification}
                        style={[styles.input, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  {/* Document upload box */}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Upload License Certificate / Document</Text>
                    <Pressable
                      onPress={() => pickImage('doc')}
                      style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      {credentialDoc ? (
                        <View style={styles.uploadedPreviewRow}>
                          <Image source={{ uri: credentialDoc }} style={styles.docPreviewThumb} />
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={[styles.uploadedFileName, { color: theme.text }]}>
                              Certificate Uploaded
                            </Text>
                            <Text style={[styles.changeDocText, { color: theme.primary }]}>Tap to change</Text>
                          </View>
                          <MaterialCommunityIcons name="check-circle" size={22} color="#10B981" />
                        </View>
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <MaterialCommunityIcons name="cloud-upload-outline" size={28} color={theme.primary} />
                          <Text style={[styles.uploadText, { color: theme.text }]}>Select Credential Document Image</Text>
                          <Text style={[styles.uploadSub, { color: theme.textSecondary }]}>JPG, PNG or PDF format</Text>
                        </View>
                      )}
                    </Pressable>
                  </View>

                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => setCounselorStep(1)}
                      style={[styles.skipBtn, { borderColor: theme.border }]}>
                      <Text style={[styles.skipBtnText, { color: theme.text }]}>← Back</Text>
                    </Pressable>
                    <Button
                      label="Next: Practice Details →"
                      onPress={() => {
                        if (!licenseNumber.trim() || !qualification.trim()) {
                          setError('Please fill in your license number and qualification.');
                          return;
                        }
                        setError('');
                        setCounselorStep(3);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}

              {/* Step 3: Practice Details */}
              {counselorStep === 3 && (
                <>
                  <Text style={[styles.stepTitle, { color: theme.primary }]}>Step 3: Practice Profile & Availability</Text>

                  {/* Specializations selection */}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Specialization Focus Areas</Text>
                    <View style={styles.specPillsContainer}>
                      {SPECIALIZATION_OPTIONS.map((spec) => {
                        const active = specializations.includes(spec);
                        return (
                          <Pressable
                            key={spec}
                            onPress={() => toggleSpecialization(spec)}
                            style={[
                              styles.specPill,
                              { borderColor: active ? theme.primary : theme.border },
                              active && { backgroundColor: theme.primarySoft },
                            ]}>
                            <Text style={[styles.specPillText, { color: active ? theme.primary : theme.text }]}>
                              {active ? '✓ ' : ''}{spec}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Bio */}
                  <View style={styles.inputContainer}>
                    <View style={styles.labelWithBadgeRow}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>Short Professional Bio</Text>
                      <Text style={[styles.emailBadge, { color: theme.textSecondary }]}>{bio.length}/300</Text>
                    </View>
                    <View style={[styles.textAreaWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                      <TextInput
                        placeholder="Licensed clinical psychologist specializing in student stress, emotional wellness..."
                        placeholderTextColor={theme.textSecondary}
                        value={bio}
                        onChangeText={(t) => setBio(t.slice(0, 300))}
                        multiline
                        numberOfLines={3}
                        style={[styles.textAreaInput, { color: theme.text }]}
                      />
                    </View>
                  </View>

                  {/* Profile Photo */}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Profile Headshot Photo</Text>
                    <View style={styles.photoUploadRow}>
                      {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.avatarPreview} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
                          <MaterialCommunityIcons name="account-circle-outline" size={36} color={theme.textSecondary} />
                        </View>
                      )}
                      <Pressable
                        onPress={() => pickImage('photo')}
                        style={[styles.uploadPhotoBtn, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                        <MaterialCommunityIcons name="camera-outline" size={18} color={theme.primary} />
                        <Text style={[styles.uploadPhotoBtnText, { color: theme.text }]}>
                          {photoUrl ? 'Change Headshot' : 'Upload Photo'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Availability */}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Working Days Availability</Text>
                    <View style={styles.yearPillsRow}>
                      {DAYS_OF_WEEK.map((day) => {
                        const active = selectedDays.includes(day);
                        return (
                          <Pressable
                            key={day}
                            onPress={() => toggleDay(day)}
                            style={[
                              styles.yearPill,
                              { borderColor: active ? theme.primary : theme.border },
                              active && { backgroundColor: theme.primarySoft },
                            ]}>
                            <Text style={[styles.yearPillText, { color: active ? theme.primary : theme.text }]}>
                              {day.slice(0, 3)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => setCounselorStep(2)}
                      style={[styles.skipBtn, { borderColor: theme.border }]}>
                      <Text style={[styles.skipBtnText, { color: theme.text }]}>← Back</Text>
                    </Pressable>
                    <Button
                      label={loading ? 'Submitting Application...' : 'Submit Application'}
                      onPress={handleCounselorSubmit}
                      disabled={loading}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}
            </Card>
          )}

          {/* Already have account link */}
          <View style={styles.footerLinkRow}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>Already have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={[styles.linkText, { color: theme.primary }]}>Sign In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ════════════════════════════════════════════════════ */}
      {/* ONE-TIME ANONYMOUS IDENTITY MODAL */}
      {/* ════════════════════════════════════════════════════ */}
      <Modal visible={showAnonModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card variant="raised" padding="four" style={[styles.anonModalCard, { backgroundColor: theme.surfaceRaised }]}>
            <View style={[styles.anonIconBox, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons name="incognito" size={36} color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Your Anonymous Identity Created!</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              When participating in peer support forums or posting anonymously, this unique ID protects your private identity.
            </Text>

            <View style={[styles.anonBadgeContainer, { backgroundColor: theme.surfaceSoft, borderColor: theme.primary }]}>
              <Text style={[styles.anonBadgeLabel, { color: theme.textSecondary }]}>YOUR UNIQUE ANONYMOUS ID</Text>
              <Text style={[styles.anonBadgeCode, { color: theme.primary }]}>{generatedAnonId}</Text>
            </View>

            <Button
              label="Got it! Continue to Profile Setup →"
              onPress={() => setStudentStep(2)}
              style={styles.actionBtn}
            />
          </Card>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  roleSegmentWrapper: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  roleSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  roleSegmentLabel: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  headerBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.body - 1,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    color: '#DC2626',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  card: {
    gap: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  stepTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionalBadge: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  stepSubtitle: {
    fontSize: FontSize.caption + 1,
    marginBottom: 4,
  },
  inputContainer: {
    gap: 6,
  },
  labelWithBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  optLabel: {
    fontWeight: FontWeight.regular,
    fontSize: FontSize.caption,
  },
  emailBadge: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: Size.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: FontSize.body,
  },
  yearPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  yearPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  yearPillText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  safetyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  safetyNoticeText: {
    flex: 1,
    fontSize: FontSize.caption,
    lineHeight: 16,
  },
  actionBtn: {
    marginTop: Spacing.two,
    height: Size.buttonHeight,
    borderRadius: BorderRadius.full,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  skipBtn: {
    paddingHorizontal: Spacing.four,
    height: Size.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  skipBtnText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },

  /* Counselor Stepper */
  stepperBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.two,
  },
  stepItem: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  stepItemText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  uploadText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  uploadSub: {
    fontSize: FontSize.caption,
  },
  uploadedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
  },
  docPreviewThumb: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
  },
  uploadedFileName: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  changeDocText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  specPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  specPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  specPillText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.two,
  },
  textAreaInput: {
    fontSize: FontSize.body - 1,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  photoUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  uploadPhotoBtnText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },

  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  footerText: {
    fontSize: FontSize.caption + 1,
  },
  linkText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  anonModalCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: BorderRadius.lg + 4,
  },
  anonIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    lineHeight: 18,
  },
  anonBadgeContainer: {
    width: '100%',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 4,
  },
  anonBadgeLabel: {
    fontSize: FontSize.caption - 1,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  anonBadgeCode: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
  },
});
