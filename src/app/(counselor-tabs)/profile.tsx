import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, Alert, Switch } from 'react-native';
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
  Spacing,
} from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useThemeContext } from '@/contexts/theme-context';
import { useMockAuth } from '@/lib/mock-auth-store';
import { auth } from '@/lib/firebase';
import {
  fetchCounselorDetail,
  fetchCounselorReviews,
  fetchAppointments,
  SupabaseCounselor,
  SupabaseReview,
} from '@/lib/supabase-db';

type AvailabilityStatus = 'online' | 'busy' | 'offline';

export default function CounselorProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, userName, avatarUrl, role } = useMockAuth();
  const { mode: themeMode, setMode: setThemeMode } = useThemeContext();

  const cName = userName || 'Kwame Ampofo';
  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'counselor-user');

  const [counselorData, setCounselorData] = useState<SupabaseCounselor | null>(null);
  const [reviews, setReviews] = useState<SupabaseReview[]>([]);
  const [completedHours, setCompletedHours] = useState<number>(48);
  const [rosterCount, setRosterCount] = useState<number>(14);

  const loadFeedbackData = async () => {
    try {
      const detail = await fetchCounselorDetail(currentUserId);
      setCounselorData(detail);
      if (detail) {
        const revList = await fetchCounselorReviews(detail.id);
        setReviews(revList);
      }

      // Dynamically load active roster size and completed log hours
      const appts = await fetchAppointments(currentUserId, 'counselor');
      const completed = appts.filter((a) => a.status === 'completed');

      // Compute total completed hours (following hours-report.tsx mapping logic)
      const totalMinutes = completed.reduce((sum, a, index) => {
        const duration = index % 2 === 0 ? 60 : 45;
        return sum + duration;
      }, 0);
      setCompletedHours(Math.round((totalMinutes / 60) * 10) / 10);

      // Compute active student roster count (following roster.tsx grouping logic)
      const uniqueStudents = new Set(
        appts
          .filter((a) => a.student_id && a.student_profile)
          .map((a) => a.student_id)
      );
      setRosterCount(uniqueStudents.size);
    } catch (err) {
      console.warn('[Counselor Profile] Error loading metrics/reviews:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFeedbackData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId])
  );

  // Availability state
  const [status, setStatus] = useState<AvailabilityStatus>('online');

  // Interactive specialties state
  const [specialties, setSpecialties] = useState([
    { id: '1', label: 'Burnout & Confidence', active: true },
    { id: '2', label: 'Personal Growth', active: true },
    { id: '3', label: 'Routines & Stress', active: false },
    { id: '4', label: 'Time Management', active: false },
  ]);

  const toggleSpecialty = (id: string) => {
    setSpecialties((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const handleCycleStatus = () => {
    setStatus((prev) => {
      if (prev === 'online') return 'busy';
      if (prev === 'busy') return 'offline';
      return 'online';
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + 160, // Fixed bottom nav overlap bug with generous padding
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          
          {/* Header */}
          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>Workspace</Text>
            <Text style={[styles.title, { color: theme.text }]}>Counselor Profile</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Manage your personal info, specialties, and support availability settings.
            </Text>
          </View>

          {/* 1. Identity card (Soft purple/indigo credential look) */}
          <CounselorIdentityCard
            name={cName}
            status={status}
            onCycleStatus={handleCycleStatus}
            avatarUrl={avatarUrl}
          />

          {/* 2. Stats widget section (Tappable dashboard rows) */}
          <View style={styles.sectionDivider}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>CLINICAL METRICS</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatWidget
              icon="clock-outline"
              iconColor={theme.info}
              iconBgColor={theme.infoSoft}
              label="Hours Logged"
              value={`${completedHours} hr${completedHours === 1 ? '' : 's'} completed`}
              onPress={() => router.push('/counselor/hours-report')}
            />
            <StatWidget
              icon="account-group"
              iconColor={theme.success}
              iconBgColor={theme.successSoft}
              label="Active Roster"
              value={`${rosterCount} student${rosterCount === 1 ? '' : 's'}`}
              onPress={() => router.push('/counselor/roster')}
            />
          </View>

          {/* 3. Clinical Specialties chips */}
          <View style={styles.sectionDivider}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>CLINICAL SPECIALTIES</Text>
          </View>
          <Card variant="surface" padding="four">
            <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
              Tap specialties to update your active clinical intake options.
            </Text>
            <View style={styles.chipsRow}>
              {specialties.map((item) => (
                <SpecialtyChip
                  key={item.id}
                  label={item.label}
                  active={item.active}
                  onPress={() => toggleSpecialty(item.id)}
                />
              ))}
            </View>
          </Card>

          {/* 4. Student Reviews & Ratings */}
          <View style={styles.sectionDivider}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>STUDENT FEEDBACK & RATINGS</Text>
          </View>
          <Card variant="surface" padding="four">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                  ★ {counselorData?.rating ? counselorData.rating.toFixed(1) : '5.0'}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                  Based on {counselorData?.review_count || reviews.length} student reviews
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <MaterialCommunityIcons key={s} name="star" size={16} color="#F59E0B" />
                ))}
              </View>
            </View>

            {reviews.length > 0 ? (
              <View style={{ gap: Spacing.two }}>
                {reviews.slice(0, 5).map((rev) => {
                  const revName = rev.is_anonymous || !rev.student_profile?.name
                    ? 'Anonymous Student'
                    : rev.student_profile.name;
                  const revDate = new Date(rev.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  return (
                    <View
                      key={rev.id}
                      style={{
                        padding: Spacing.three,
                        borderRadius: 12,
                        backgroundColor: theme.surfaceSoft,
                        gap: 4,
                      }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{revName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <MaterialCommunityIcons
                              key={s}
                              name={s <= rev.rating ? 'star' : 'star-outline'}
                              size={12}
                              color="#F59E0B"
                            />
                          ))}
                        </View>
                      </View>
                      {rev.comment ? (
                        <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 16 }}>
                          &ldquo;{rev.comment}&rdquo;
                        </Text>
                      ) : null}
                      <Text style={{ fontSize: 10, color: theme.textSecondary, alignSelf: 'flex-end' }}>
                        {revDate}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: theme.textSecondary, fontStyle: 'italic' }}>
                No student reviews recorded yet.
              </Text>
            )}
          </Card>

          {/* 5. Credentials Verification panel */}
          <View style={styles.sectionDivider}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TRUST & LICENSING</Text>
          </View>
          <VerificationPanel />

          {/* Dark Mode Toggle */}
          <View style={styles.sectionDivider}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>APPEARANCE</Text>
          </View>
          <Card variant="surface" padding="three" style={{ borderRadius: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="theme-light-dark" size={18} color={theme.primary} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Dark Mode</Text>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                trackColor={{ true: theme.primary, false: theme.surfaceMuted }}
                thumbColor={theme.onPrimary}
              />
            </View>
          </Card>

          {/* App Info & Attribution */}
          <View style={styles.appInfo}>
            <Image
              source={require('@/assets/images/mindknust-logo.png')}
              style={styles.appInfoLogo}
              resizeMode="contain"
            />
            <Text style={[styles.appInfoText, { color: theme.textSecondary, fontWeight: FontWeight.semibold }]}>
              MindKNUST Clinical Portal v1.0.0
            </Text>
            <Text style={[styles.appInfoText, { color: theme.textSecondary }]}>
              KNUST Counseling Center & Student Affairs
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsBox}>
            <Button
              label="Edit Profile Details"
              variant="secondary"
              onPress={() => router.push('/edit-profile')}
              style={styles.editBtn}
            />

            <Pressable
              onPress={async () => {
                await logout();
                router.replace('/(auth)/login');
              }}
              style={styles.logoutBtn}>
              <MaterialCommunityIcons name="logout" size={18} color={theme.error} style={{ marginRight: 6 }} />
              <Text style={[styles.logoutText, { color: theme.error }]}>Log Out Account</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

/* Custom Identity Card Component with verified badge and availability dot */
function CounselorIdentityCard({
  name,
  status,
  onCycleStatus,
  avatarUrl,
}: {
  name: string;
  status: AvailabilityStatus;
  onCycleStatus: () => void;
  avatarUrl?: string | null;
}) {
  const theme = useTheme();

  const getStatusColor = () => {
    if (status === 'online') return '#34C759'; // Green
    if (status === 'busy') return '#FF9500'; // Orange
    return '#8E8E93'; // Grey
  };

  const getStatusLabel = () => {
    if (status === 'online') return 'Available now';
    if (status === 'busy') return 'In session';
    return 'Offline';
  };

  return (
    <Card variant="raised" padding="four" style={[styles.credentialCard, { backgroundColor: theme.primarySoft, borderColor: `${theme.primary}33` }]}>
      <View style={styles.cardHeader}>
        {/* Availability Badge */}
        <Pressable onPress={onCycleStatus} style={[styles.statusBadge, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusLabel, { color: theme.text }]}>{getStatusLabel()}</Text>
          <MaterialCommunityIcons name="chevron-down" size={14} color={theme.textSecondary} style={{ marginLeft: 2 }} />
        </Pressable>

        <Text style={[styles.staffId, { color: theme.primary }]}>ID: CC-90812</Text>
      </View>

      <View style={styles.identityRow}>
        <Avatar name={name} size="lg" source={avatarUrl ? { uri: avatarUrl } : undefined} />
        <View style={styles.identityInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { color: theme.text }]}>{name}</Text>
            <View style={[styles.verifiedBadge, { backgroundColor: theme.primary }]}>
              <MaterialCommunityIcons name="check" size={11} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.roleText, { color: theme.textSecondary }]}>Wellbeing Coach & Licensed Counselor</Text>
          <View style={styles.affiliationRow}>
            <MaterialCommunityIcons name="school-outline" size={14} color={theme.primary} />
            <Text style={[styles.affiliationText, { color: theme.textSecondary }]}>KNUST Campus Division</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/* Custom icon-led tappable stat widget */
function StatWidget({
  icon,
  iconColor,
  iconBgColor,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        {
          backgroundColor: pressed ? theme.surfaceSoft : theme.surfaceRaised,
          borderColor: pressed ? theme.primary : theme.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        isDark ? Shadows.dark.card : Shadows.light.card,
      ]}>
      <View style={[styles.statIconBox, { backgroundColor: iconBgColor }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.statMeta}>
        <Text numberOfLines={1} style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text numberOfLines={1} style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      </View>
      <View style={[styles.statArrowContainer, { backgroundColor: theme.surfaceSoft }]}>
        <MaterialCommunityIcons name="chevron-right" size={16} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

/* Specialty tag chip with dynamic styling (filled purple active / grey outline inactive) */
function SpecialtyChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.primary : 'transparent',
        },
      ]}>
      {active ? (
        <MaterialCommunityIcons name="check-circle" size={14} color={theme.onPrimary} style={{ marginRight: 4 }} />
      ) : (
        <MaterialCommunityIcons name="plus" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.chipText, { color: active ? theme.onPrimary : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* Custom Trust and Credential Panel with Verification facts */
function VerificationPanel() {
  const theme = useTheme();
  return (
    <Card variant="surface" padding="four" style={styles.trustCard}>
      <View style={styles.trustHeader}>
        <Text style={[styles.trustTitle, { color: theme.text }]}>Verified Clinical Credentials</Text>
        <View style={styles.verifiedBadgePill}>
          <MaterialCommunityIcons name="shield-check" size={14} color="#34C759" style={{ marginRight: 4 }} />
          <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
        </View>
      </View>

      <View style={styles.trustList}>
        <VerificationRow
          label="Credential validation"
          description="Licensed with Ghana national campus counseling board"
        />
        <VerificationRow
          label="Clinical Affiliation"
          description="Active support advisor for KNUST Health Center"
        />
      </View>

      <Pressable
        onPress={() => Alert.alert('Licensing', 'Displaying official national registration certificate details.')}
        style={styles.trustLink}>
        <Text style={[styles.trustLinkText, { color: theme.primary }]}>View official digital license</Text>
        <MaterialCommunityIcons name="open-in-new" size={12} color={theme.primary} />
      </Pressable>
    </Card>
  );
}

function VerificationRow({ label, description }: { label: string; description: string }) {
  const theme = useTheme();
  return (
    <View style={styles.verificationRow}>
      <View style={styles.verificationCheckWrap}>
        <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={18} color="#34C759" />
      </View>
      <View style={styles.verificationText}>
        <Text style={[styles.verificationLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.verificationDesc, { color: theme.textSecondary }]}>{description}</Text>
      </View>
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
  titleBlock: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
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
  credentialCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  staffId: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  identityRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  identityInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: FontSize.body + 1,
    fontWeight: FontWeight.bold,
  },
  verifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.semibold,
  },
  affiliationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  affiliationText: {
    fontSize: FontSize.caption,
  },
  sectionDivider: {
    marginTop: Spacing.two,
  },
  sectionLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  statsGrid: {
    flexDirection: 'column',
    gap: Spacing.three,
  },
  statCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    position: 'relative',
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  statMeta: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  statValue: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.medium,
  },
  statArrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.two,
  },
  statArrow: {
    marginLeft: 2,
  },
  cardDescription: {
    fontSize: FontSize.caption,
    marginBottom: Spacing.three,
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.medium,
  },
  trustCard: {
    borderRadius: BorderRadius.md,
  },
  trustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  trustTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  verifiedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C7591A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  verifiedBadgeText: {
    color: '#34C759',
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  trustList: {
    gap: Spacing.three,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  verificationCheckWrap: {
    marginTop: 2,
  },
  verificationText: {
    flex: 1,
    gap: 1,
  },
  verificationLabel: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  verificationDesc: {
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  trustLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.three,
    alignSelf: 'flex-start',
  },
  trustLinkText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  appInfo: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
  appInfoLogo: {
    width: 48,
    height: 48,
    marginBottom: 4,
  },
  appInfoText: {
    fontSize: FontSize.small,
  },
  actionsBox: {
    width: '100%',
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  editBtn: {
    width: '100%',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    alignSelf: 'center',
  },
  logoutText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
});
