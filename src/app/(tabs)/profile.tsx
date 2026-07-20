import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export default function ProfileScreen() {
  const { userName, avatarUrl, logout } = useMockAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [sessionsCount, setSessionsCount] = useState(0);
  const [moodStreak, setMoodStreak] = useState(0);
  const [connectedCounselor, setConnectedCounselor] = useState<any>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const loadProfileData = async () => {
    try {
      const appts = await fetchAppointments(currentUserId, 'student');
      const activeAppts = appts.filter((a) => ['accepted', 'completed'].includes(a.status));
      setSessionsCount(activeAppts.length);

      const firstActive = appts.find((a) => a.counselor_profile);
      if (firstActive) {
        setConnectedCounselor({
          id: firstActive.counselor_id,
          name: firstActive.counselor_profile?.name || 'Counselor',
          avatar_url: firstActive.counselor_profile?.avatar_url,
        });
      }

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

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* ── Profile Header ── */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarWrapper}>
              <Avatar
                name={userName || 'User'}
                size="lg"
                source={avatarUrl ? { uri: avatarUrl } : undefined}
              />
              <View style={[styles.onlineDot, { backgroundColor: '#34C759' }]} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }]}>
                {userName || 'KNUST Student'}
              </Text>
              <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                Student · KNUST Campus
              </Text>
            </View>
            <View style={[styles.rolePill, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons name="shield-check" size={14} color={theme.primary} />
              <Text style={[styles.rolePillText, { color: theme.primary }]}>Verified</Text>
            </View>
          </View>

          {/* ── Quick Actions ── */}
          <View style={styles.quickActions}>
            <QuickAction
              icon="account-edit-outline"
              label="Edit Profile"
              color={theme.primary}
              onPress={() => router.push('/edit-profile')}
            />
            <QuickAction
              icon="notebook-outline"
              label="Mood History"
              color="#FF6B4A"
              onPress={() => router.push('/mood-history')}
            />
            <QuickAction
              icon="bell-outline"
              label="Alerts"
              color="#D97706"
              onPress={() => router.push('/notifications')}
            />
            <QuickAction
              icon="help-circle-outline"
              label="Help"
              color={theme.success}
              onPress={() => Alert.alert('Contact Support', 'KNUST Counselor support team email: support@counselcare.edu')}
            />
          </View>

          {/* ── Stats Row ── */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#EAE8FF' }]}>
                <MaterialCommunityIcons name="calendar-check" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{sessionsCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sessions</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="fire" size={18} color="#FF6B4A" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{moodStreak}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Mood entries</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIconCircle, { backgroundColor: '#E6F4EA' }]}>
                <MaterialCommunityIcons name="account-group" size={18} color="#3F8C7A" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
                {connectedCounselor ? '1' : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Counselor</Text>
            </View>
          </View>

          {/* ── Connected Counselor ── */}
          {connectedCounselor && (
            <View style={[styles.counselorBanner, { backgroundColor: theme.primarySoft, borderColor: `${theme.primary}22` }]}>
              <View style={styles.counselorBannerLeft}>
                <Avatar
                  name={connectedCounselor.name}
                  size="sm"
                  source={{ uri: getCounselorPhoto(connectedCounselor.name, connectedCounselor.avatar_url) }}
                />
                <View style={styles.counselorBannerInfo}>
                  <Text style={[styles.counselorBannerLabel, { color: theme.textSecondary }]}>Your counselor</Text>
                  <Text style={[styles.counselorBannerName, { color: theme.text }]}>{connectedCounselor.name}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/chats')}
                style={[styles.counselorBannerBtn, { backgroundColor: theme.primary }]}
              >
                <MaterialCommunityIcons name="message-outline" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* ── Account Section ── */}
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>ACCOUNT</Text>
          <View style={[styles.settingsGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingsRow
              icon="account-outline"
              label="Personal Information"
              iconBg="#EAE8FF"
              iconColor={theme.primary}
              showChevron
              onPress={() => router.push('/edit-profile')}
            />
            <SettingsRow
              icon="bell-outline"
              label="Notifications"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              isLast
            >
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ true: theme.primary, false: theme.surfaceMuted }}
                thumbColor="#FFFFFF"
              />
            </SettingsRow>
          </View>

          {/* ── Preferences Section ── */}
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>PREFERENCES</Text>
          <View style={[styles.settingsGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingsRow
              icon="theme-light-dark"
              label="Dark Mode"
              iconBg="#1E293B"
              iconColor="#CBD5E1"
            >
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
                trackColor={{ true: theme.primary, false: theme.surfaceMuted }}
                thumbColor="#FFFFFF"
              />
            </SettingsRow>
            <SettingsRow
              icon="earth"
              label="Language"
              iconBg="#E6F4EA"
              iconColor={theme.success}
              rightText="English (US)"
              showChevron
            />
            <SettingsRow
              icon="message-text-outline"
              label="Communication Style"
              iconBg="#EAE8FF"
              iconColor={theme.primary}
              rightText="Gentle"
              showChevron
              isLast
            />
          </View>

          {/* ── Support & Legal Section ── */}
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>SUPPORT & LEGAL</Text>
          <View style={[styles.settingsGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingsRow
              icon="help-circle-outline"
              label="Help & Contact Us"
              iconBg="#E6F4EA"
              iconColor={theme.success}
              showChevron
              onPress={() => Alert.alert('Contact Support', 'KNUST Counselor support team email: support@counselcare.edu')}
            />
            <SettingsRow
              icon="shield-lock-outline"
              label="Privacy Policy"
              iconBg="#EAE8FF"
              iconColor={theme.primary}
              showChevron
              onPress={() => Alert.alert('Privacy Policy', 'Opening KNUST counseling network security page...')}
            />
            <SettingsRow
              icon="database-outline"
              label="Data & Storage"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              showChevron
              onPress={() => Alert.alert('Data Export', 'An offline archive containing all your counselor charts and daily logs will be compiled and sent to your university inbox within 24 hours.')}
              isLast
            />
          </View>

          {/* ── App Info ── */}
          <View style={styles.appInfo}>
            <Text style={[styles.appInfoText, { color: theme.textSecondary }]}>CounselCare v1.0.0</Text>
            <Text style={[styles.appInfoText, { color: theme.textSecondary }]}>KNUST Campus Wellbeing</Text>
          </View>

          {/* ── Logout ── */}
          <Pressable
            style={({ pressed }) => [
              styles.logoutBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && { opacity: 0.7 },
            ]}
            onPress={async () => {
              await logout();
              router.replace('/(auth)/login');
            }}
          >
            <MaterialCommunityIcons name="logout" size={18} color="#FF3B30" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>

        </View>
      </ScrollView>
    </View>
  );
}

/* ── Quick Action Button ── */
function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}14` }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

/* ── Settings Row ── */
function SettingsRow({
  icon,
  iconBg,
  iconColor,
  label,
  rightText,
  showChevron,
  isLast,
  children,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  rightText?: string;
  showChevron?: boolean;
  isLast?: boolean;
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
        pressed && onPress && { backgroundColor: theme.surfaceSoft },
      ]}
    >
      <View style={styles.settingsRowLeft}>
        <View style={[styles.settingsRowIcon, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={[styles.settingsLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {rightText && (
          <Text style={[styles.settingsRightText, { color: theme.textSecondary }]}>{rightText}</Text>
        )}
        {showChevron && (
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textSecondary} />
        )}
        {children}
      </View>
    </Pressable>
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
    gap: Spacing.three,
  },

  /* ── Profile Header ── */
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  avatarWrapper: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  profileEmail: {
    fontSize: FontSize.caption,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
  },
  rolePillText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },

  /* ── Quick Actions ── */
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
    color: '#6B7280',
  },

  /* ── Stats ── */
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.one,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.small,
  },

  /* ── Counselor Banner ── */
  counselorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  counselorBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  counselorBannerInfo: {
    gap: 1,
  },
  counselorBannerLabel: {
    fontSize: FontSize.small,
  },
  counselorBannerName: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  counselorBannerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Section Headers ── */
  sectionHeader: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginTop: Spacing.one,
  },

  /* ── Settings Group ── */
  settingsGroup: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  settingsRowIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: FontSize.caption,
  },

  /* ── App Info ── */
  appInfo: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  appInfoText: {
    fontSize: FontSize.small,
  },

  /* ── Logout ── */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
});
