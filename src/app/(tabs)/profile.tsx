import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, Button } from '@/components/ui';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  MaxContentWidth,
  Shadows,
  Size,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { fetchAppointments, fetchMoodLogs } from '@/lib/supabase-db';
import { getCounselorPhoto } from './sessions';

import CounselorProfileScreen from '../(counselor-tabs)/profile';

export default function ProfileScreen() {
  const { role, userName, logout } = useMockAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Supabase states
  const [sessionsCount, setSessionsCount] = useState(0);
  const [moodStreak, setMoodStreak] = useState(0);
  const [connectedCounselor, setConnectedCounselor] = useState<any>(null);

  // App Toggles
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  // Interactive Preference Chips
  const [prefOnline, setPrefOnline] = useState(true);
  const [prefEvenings, setPrefEvenings] = useState(false);
  const [prefReminders, setPrefReminders] = useState(true);
  const [prefPrivate, setPrefPrivate] = useState(false);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const loadProfileData = async () => {
    try {
      // 1. Fetch completed/active appointments count
      const appts = await fetchAppointments(currentUserId, 'student');
      const activeAppts = appts.filter((a) => ['accepted', 'completed'].includes(a.status));
      setSessionsCount(activeAppts.length);

      // Find first counselor they booked sessions with
      const firstActive = appts.find((a) => a.counselor_profile);
      if (firstActive) {
        setConnectedCounselor({
          id: firstActive.counselor_id,
          name: firstActive.counselor_profile?.name || 'Counselor',
          avatar_url: firstActive.counselor_profile?.avatar_url,
        });
      }

      // 2. Fetch mood logs history
      const logs = await fetchMoodLogs(currentUserId);
      setMoodStreak(logs.length);
    } catch (e) {
      console.warn('Profile stats sync failed:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (role === 'counselor') {
    return <CounselorProfileScreen />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header section */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings Portal</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 128 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          
          {/* Identity Card: Visual Anchor banner */}
          <Card variant="raised" padding="four" style={[styles.heroCard, { backgroundColor: theme.primary }]}>
            <View style={styles.profileTopRow}>
              <Avatar name={userName || 'User'} size="lg" />
              <View style={styles.profileMeta}>
                <View style={styles.badgeRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>CounselCare Member</Text>
                  </View>
                </View>
                <Text style={styles.nameText}>{userName || 'KNUST Student'}</Text>
                <Text style={styles.noteText}>Student Wellbeing Care Plan active</Text>
              </View>
            </View>
          </Card>

          {/* Stats: Widget-style Dashboard metrics */}
          <View style={styles.statsRow}>
            <StatCard
              icon="calendar-check"
              value={`${sessionsCount} completed`}
              label="Approved Care Sessions"
              color={theme.primary}
            />
            <StatCard
              icon="fire"
              value={`${moodStreak} entries`}
              label="Mood Journal Logs"
              color="#FF6B4A"
            />
          </View>

          {/* CTA: View Mood History */}
          <Button
            label="View Mood Journal History"
            variant="secondary"
            onPress={() => router.push('/mood-history')}
            style={styles.journalCta}
          />

          {/* Connected Counselor status */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>YOUR ASSIGNED ADVISOR</Text>
          {connectedCounselor ? (
            <Card variant="surface" padding="three" style={styles.counselorCard}>
              <View style={styles.counselorContent}>
                <Avatar
                  name={connectedCounselor.name}
                  size="md"
                  source={{ uri: getCounselorPhoto(connectedCounselor.name, connectedCounselor.avatar_url) }}
                />
                <View style={styles.counselorMeta}>
                  <Text style={[styles.counselorName, { color: theme.text }]}>{connectedCounselor.name}</Text>
                  <Text style={[styles.counselorSub, { color: theme.textSecondary }]}>Active Counselor</Text>
                </View>
              </View>
              <Button
                label="Message"
                variant="primary"
                style={styles.counselorBtn}
                onPress={() => router.push('/chats')}
              />
            </Card>
          ) : (
            <Card variant="surface" padding="three" style={styles.counselorCard}>
              <View style={styles.counselorContent}>
                <View style={[styles.emptyIconBox, { backgroundColor: theme.primarySoft }]}>
                  <MaterialCommunityIcons name="doctor" size={24} color={theme.primary} />
                </View>
                <View style={styles.counselorMeta}>
                  <Text style={[styles.counselorName, { color: theme.text }]}>No counselor assigned</Text>
                  <Text style={[styles.counselorSub, { color: theme.textSecondary }]}>Book a session to connect with one</Text>
                </View>
              </View>
              <Button
                label="Find counselor"
                variant="secondary"
                style={styles.counselorBtn}
                onPress={() => router.push('/(tabs)/sessions')}
              />
            </Card>
          )}

          {/* Interactive Preferences */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>COMMUNICATION PREFERENCES</Text>
          <Card variant="surface" padding="three" style={styles.preferencesCard}>
            <View style={styles.preferenceRow}>
              <PreferenceChip
                label="Online sessions"
                selected={prefOnline}
                onToggle={() => setPrefOnline(!prefOnline)}
              />
              <PreferenceChip
                label="Evenings"
                selected={prefEvenings}
                onToggle={() => setPrefEvenings(!prefEvenings)}
              />
              <PreferenceChip
                label="Gentle reminders"
                selected={prefReminders}
                onToggle={() => setPrefReminders(!prefReminders)}
              />
              <PreferenceChip
                label="Private notes"
                selected={prefPrivate}
                onToggle={() => setPrefPrivate(!prefPrivate)}
              />
            </View>
          </Card>

          {/* App Settings */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>APP CONFIGURATION</Text>
          <Card variant="surface" padding="four" style={styles.settingsCard}>
            <SettingsRow icon="bell-outline" label="In-App Alerts">
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ true: theme.primary, false: theme.border }}
                thumbColor="#FFFFFF"
              />
            </SettingsRow>
            <SettingsRow icon="theme-light-dark" label="Force Dark Theme">
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
                trackColor={{ true: theme.primary, false: theme.border }}
                thumbColor="#FFFFFF"
              />
            </SettingsRow>
            <SettingsRow icon="earth" label="Language" rightText="English (US)" />
            <Pressable onPress={() => Alert.alert('Contact Support', 'KNUST Counselor support team email: support@counselcare.edu')}>
              <SettingsRow icon="help-circle-outline" label="Help & Contact Us" showChevron />
            </Pressable>
          </Card>

          {/* Privacy & Trust disclosures */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PRIVACY & TRUST</Text>
          <Card variant="surface" padding="four" style={styles.privacyCard}>
            <View style={styles.privacyLayout}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color={theme.success} />
              <View style={styles.privacyTextContent}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>Data Security Policy</Text>
                <Text style={[styles.privacyBody, { color: theme.textSecondary }]}>
                  All conversation channels, booking notes, and wellbeing records are encrypted on private Supabase nodes.
                </Text>
              </View>
            </View>
            <View style={styles.privacyActions}>
              <Pressable onPress={() => Alert.alert('Data Export', 'An offline archive containing all your counselor charts and daily logs will be compiled and sent to your university inbox within 24 hours.')} style={styles.privacyLinkBtn}>
                <Text style={[styles.privacyLinkText, { color: theme.primary }]}>Request Data Archive</Text>
              </Pressable>
              <Pressable onPress={() => Alert.alert('Privacy Policy', 'Opening KNUST counseling network security page in your browser...')} style={styles.privacyLinkBtn}>
                <Text style={[styles.privacyLinkText, { color: theme.primary }]}>View Privacy Policy</Text>
              </Pressable>
            </View>
          </Card>

          {/* Edit profile */}
          <Button
            label="Edit profile"
            variant="secondary"
            onPress={() => router.push('/edit-profile')}
            style={styles.editButton}
          />

          {/* Logout separation */}
          <Pressable
            style={styles.logoutBtn}
            onPress={async () => {
              await logout();
              router.replace('/(auth)/login');
            }}>
            <MaterialCommunityIcons name="logout" size={18} color="#FF3B30" />
            <Text style={styles.logoutText}>Log Out Account</Text>
          </Pressable>

        </View>
      </ScrollView>
    </View>
  );
}

// 1. Dashboard Widget Stat Card
function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  const theme = useTheme();
  return (
    <Card variant="surface" padding="three" style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: `${color}1A` }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </Card>
  );
}

// 2. Interactive Preference Chip
function PreferenceChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.preferenceChip,
        { borderColor: theme.border, backgroundColor: theme.surfaceSoft },
        selected && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
      ]}>
      {selected && <MaterialCommunityIcons name="check" size={12} color={theme.primary} />}
      <Text style={[styles.prefChipText, { color: theme.textSecondary }, selected && { color: theme.primary, fontWeight: FontWeight.semibold }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// 3. App Settings Configuration Row
function SettingsRow({
  icon,
  label,
  rightText,
  showChevron,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  rightText?: string;
  showChevron?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.settingsRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingsRowLeft}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.primary} />
        <Text style={[styles.settingsLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {rightText && <Text style={[styles.settingsRightText, { color: theme.textSecondary }]}>{rightText}</Text>}
        {showChevron && <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textSecondary} />}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  heroCard: {
    borderRadius: BorderRadius.md + 4,
    ...Shadows.light.card,
  },
  profileTopRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    alignItems: 'center',
  },
  profileMeta: {
    flex: 1,
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  roleBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  noteText: {
    color: 'rgba(255, 255, 255, 0.84)',
    fontSize: FontSize.caption,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.04)',
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  statLabel: {
    fontSize: FontSize.caption - 1,
  },
  journalCta: {
    borderRadius: BorderRadius.full,
    height: Size.buttonHeight - 4,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  counselorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    gap: Spacing.two,
  },
  counselorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counselorMeta: {
    gap: 2,
  },
  counselorName: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  counselorSub: {
    fontSize: FontSize.caption,
  },
  counselorBtn: {
    height: 34,
    paddingHorizontal: Spacing.three,
  },
  preferencesCard: {
    borderRadius: BorderRadius.md,
  },
  preferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  preferenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  prefChipText: {
    fontSize: FontSize.caption,
  },
  settingsCard: {
    borderRadius: BorderRadius.md,
    gap: Spacing.two,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  settingsLabel: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.medium,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  settingsRightText: {
    fontSize: FontSize.caption + 1,
  },
  privacyCard: {
    borderRadius: BorderRadius.md,
    gap: Spacing.three,
  },
  privacyLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  privacyTextContent: {
    flex: 1,
    gap: 3,
  },
  privacyTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  privacyBody: {
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  privacyActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: 'rgba(17, 24, 39, 0.06)',
    paddingTop: Spacing.two + 2,
    marginTop: Spacing.one,
  },
  privacyLinkBtn: {
    paddingVertical: 4,
  },
  privacyLinkText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  editButton: {
    borderRadius: BorderRadius.full,
    height: Size.buttonHeight,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
});
