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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMockAuth } from '@/lib/mock-auth-store';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, hasFirebaseConfig } from '@/lib/firebase';

import { upsertProfile, createCounselorMetadata } from '@/lib/supabase-db';

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useMockAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'counselor'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (hasFirebaseConfig && auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        const userUid = userCredential.user.uid;

        // Dynamic registration write to profiles
        await upsertProfile(userUid, name, email, role);

        // If user is a counselor, initialize their metadata sheet
        if (role === 'counselor') {
          await createCounselorMetadata(userUid);
        }
      }
      await login(role, email, name);
      setLoading(false);
      router.replace('/');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to register.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Join CounselCare to access counseling and wellness tools.
            </Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.surfaceSoft, borderColor: '#EF4444' }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Register Card */}
          <Card variant="raised" padding="four" style={styles.card}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name</Text>
              <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                <MaterialCommunityIcons name="account-outline" size={20} color={theme.textSecondary} />
                <TextInput
                  placeholder="John Doe"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
              <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
                <MaterialCommunityIcons name="email-outline" size={20} color={theme.textSecondary} />
                <TextInput
                  placeholder="name@university.edu"
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
              <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
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

            {/* Role Cards Selector */}
            <View style={styles.roleSelectionBlock}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Register As</Text>
              <View style={styles.roleCardsRow}>
                <Pressable
                  onPress={() => setRole('student')}
                  style={[
                    styles.roleCard,
                    { borderColor: role === 'student' ? theme.primary : theme.border, backgroundColor: theme.surfaceSoft },
                    role === 'student' && { backgroundColor: theme.primarySoft },
                  ]}>
                  <MaterialCommunityIcons
                    name="school-outline"
                    size={32}
                    color={role === 'student' ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.roleCardTitle, { color: theme.text }]}>Student</Text>
                  <Text style={[styles.roleCardSub, { color: theme.textSecondary }]}>
                    Get advice and support
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setRole('counselor')}
                  style={[
                    styles.roleCard,
                    { borderColor: role === 'counselor' ? theme.primary : theme.border, backgroundColor: theme.surfaceSoft },
                    role === 'counselor' && { backgroundColor: theme.primarySoft },
                  ]}>
                  <MaterialCommunityIcons
                    name="doctor"
                    size={32}
                    color={role === 'counselor' ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.roleCardTitle, { color: theme.text }]}>Counselor</Text>
                  <Text style={[styles.roleCardSub, { color: theme.textSecondary }]}>
                    Manage schedules & help
                  </Text>
                </Pressable>
              </View>
            </View>

            <Button
              label={loading ? 'Registering...' : 'Register'}
              onPress={handleRegister}
              disabled={loading}
              style={styles.button}
            />
          </Card>

          {/* Already have account link */}
          <View style={styles.footerLinkRow}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={[styles.linkText, { color: theme.primary }]}>Sign In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
    maxWidth: 420,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  headerBlock: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: FontSize.h1 + 4,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: FontSize.body - 1,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
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
    color: '#B91C1C',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  card: {
    gap: Spacing.three,
    borderRadius: BorderRadius.md + 4,
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
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
  roleSelectionBlock: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  roleCardsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: 6,
  },
  roleCardTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  roleCardSub: {
    fontSize: FontSize.small,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.two,
    height: Size.buttonHeight,
    borderRadius: BorderRadius.full,
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  footerText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.medium,
  },
  linkText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
});
