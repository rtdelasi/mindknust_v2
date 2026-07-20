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

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BorderRadius, FontSize, FontWeight, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMockAuth } from '@/lib/mock-auth-store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import { supabase, hasSupabaseConfig } from '@/lib/supabase';

import { upsertProfile } from '@/lib/supabase-db';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useMockAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'counselor'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      let displayName = email.split('@')[0];
      if (hasFirebaseConfig && auth) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Enforce user role from Supabase to block wrong portal login
        let dbRole: 'student' | 'counselor' = 'student';
        let profileExists = false;

        if (hasSupabaseConfig && supabase) {
          const { data, error: roleError } = await supabase
            .from('profiles')
            .select('role, name')
            .eq('id', userCredential.user.uid)
            .maybeSingle();

          if (!roleError && data?.role) {
            dbRole = data.role as 'student' | 'counselor';
            profileExists = true;
            if (data.name) {
              displayName = data.name;
            }
          } else {
            dbRole = email.endsWith('@counselcare.edu') ? 'counselor' : 'student';
          }
        } else {
          dbRole = email.endsWith('@counselcare.edu') ? 'counselor' : 'student';
        }

        if (dbRole !== role) {
          const { signOut } = await import('firebase/auth');
          await signOut(auth);
          throw new Error(`This account is registered as a ${dbRole}. Please use the ${dbRole === 'student' ? 'Student' : 'Counselor'} Portal.`);
        }

        // Auto-create profile in Supabase if missing
        if (!profileExists && hasSupabaseConfig) {
          const defaultName = email.split('@')[0];
          await upsertProfile(userCredential.user.uid, defaultName, email, dbRole);
          displayName = defaultName;
        }
      }
      await login(role, email, displayName);
      setLoading(false);
      router.replace('/');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to sign in.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Brand Logo & Header */}
          <View style={styles.headerBlock}>
            <View style={[styles.logoIconWrap, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons name="heart-pulse" size={42} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>CounselCare</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Your campus mental health and wellbeing portal.
            </Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.surfaceSoft, borderColor: '#EF4444' }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Role Selection Tabs */}
          <View style={[styles.roleTabs, { backgroundColor: theme.surfaceMuted }]}>
            <Pressable
              onPress={() => setRole('student')}
              style={[
                styles.roleTabButton,
                role === 'student' && [styles.roleTabButtonActive, { backgroundColor: theme.primary }],
              ]}>
              <MaterialCommunityIcons
                name="school"
                size={Size.iconMd}
                color={role === 'student' ? theme.onPrimary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.roleTabText,
                  { color: role === 'student' ? theme.onPrimary : theme.textSecondary },
                ]}>
                Student Portal
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setRole('counselor')}
              style={[
                styles.roleTabButton,
                role === 'counselor' && [styles.roleTabButtonActive, { backgroundColor: theme.primary }],
              ]}>
              <MaterialCommunityIcons
                name="doctor"
                size={Size.iconMd}
                color={role === 'counselor' ? theme.onPrimary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.roleTabText,
                  { color: role === 'counselor' ? theme.onPrimary : theme.textSecondary },
                ]}>
                Counselor
              </Text>
            </Pressable>
          </View>

          {/* Login Card */}
          <Card variant="raised" padding="four" style={styles.loginCard}>
            <Text style={[styles.cardHeader, { color: theme.text }]}>
              Sign In as {role === 'student' ? 'Student' : 'Counselor'}
            </Text>

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

            <Button
              label={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleLogin}
              disabled={loading}
              style={styles.loginButton}
            />
          </Card>

          {/* Register Link */}
          <View style={styles.footerLinkRow}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {"Don't have an account? "}
            </Text>
            <Pressable onPress={() => router.push('/(auth)/register')}>
              <Text style={[styles.linkText, { color: theme.primary }]}>Sign Up</Text>
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
    maxWidth: 400,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  headerBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  logoIconWrap: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.h1 + 6,
    fontWeight: FontWeight.bold,
    letterSpacing: -1,
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
  roleTabs: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    padding: 4,
    gap: 4,
  },
  roleTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.full,
  },
  roleTabButtonActive: {
    ...Shadows.light.card,
  },
  roleTabText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  loginCard: {
    gap: Spacing.three,
    borderRadius: BorderRadius.md + 4,
  },
  cardHeader: {
    fontSize: FontSize.h3 + 2,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.one,
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
  loginButton: {
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
