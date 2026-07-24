import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert, Switch } from 'react-native';
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
import { useTheme } from '@/hooks/use-theme';
import { useThemeContext } from '@/contexts/theme-context';
import { useMockAuth } from '@/lib/mock-auth-store';

type AvailabilityStatus = 'online' | 'busy' | 'offline';

export default function CounselorProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, userName, avatarUrl } = useMockAuth();
  const { mode: themeMode, setMode: setThemeMode } = useThemeContext();

  const cName = userName || 'Kwame Ampofo';

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
              label="Hours logs"
              value="48 completed"
              onPress={() => router.push('/counselor/hours-report')}
            />
            <StatWidget
              icon="account-supervisor-circle"
              label="Active roster"
              value="14 students"
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

          {/* 4. Credentials Verification panel */}
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
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="theme-light-dark" size={18} color="#CBD5E1" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '500', color: theme.text }}>Dark Mode</Text>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                trackColor={{ true: theme.primary, false: theme.surfaceMuted }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>

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
              <MaterialCommunityIcons name="logout" size={18} color="#FF3B30" style={{ marginRight: 6 }} />
              <Text style={styles.logoutText}>Log Out Account</Text>
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
  label,
  value,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[styles.statIconBox, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.statMeta}>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textSecondary} style={styles.statArrow} />
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
        <MaterialCommunityIcons name="check-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
      ) : (
        <MaterialCommunityIcons name="plus" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
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
    flexDirection: 'row',
    gap: Spacing.three,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    position: 'relative',
    ...Shadows.light.card,
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
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  statValue: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
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
    color: '#FF3B30',
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
});
