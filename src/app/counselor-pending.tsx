import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMockAuth } from '@/lib/mock-auth-store';
import { auth } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { fetchCounselorProfile, SupabaseCounselorProfile } from '@/lib/supabase-db';

export default function CounselorPendingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, logout, login } = useMockAuth();

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SupabaseCounselorProfile | null>(null);

  const currentUserId = auth?.currentUser?.uid || 'counselor-user';

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCounselorProfile(currentUserId);
      if (data) {
        setProfile(data);
        if (data.approval_status === 'approved') {
          // Upgrade auth state and redirect to counselor tabs
          await login('counselor', data.profile?.email || 'counselor@knust.edu.gh', data.profile?.name || userName, data.photo_url || undefined, undefined, 'approved');
          router.replace('/(counselor-tabs)');
        }
      }
    } catch (e) {
      console.warn('Error checking counselor status:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, login, router, userName]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Realtime subscription: auto-transition when admin approves while this screen is open
  useEffect(() => {
    if (!supabase || !currentUserId) return;

    const channel = supabase
      .channel(`counselor-status-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'counselor_profiles',
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const updated = payload.new as { approval_status?: string };
          if (updated?.approval_status === 'approved') {
            checkStatus();
          } else if (updated?.approval_status === 'rejected') {
            // Refresh profile to show rejection reason
            checkStatus();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, checkStatus]);

  const isRejected = profile?.approval_status === 'rejected';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Status Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isRejected ? '#FEE2E2' : theme.primarySoft,
                borderColor: isRejected ? '#EF4444' : theme.primary,
              },
            ]}>
            <MaterialCommunityIcons
              name={isRejected ? 'close-circle-outline' : 'clock-outline'}
              size={48}
              color={isRejected ? '#DC2626' : theme.primary}
            />
          </View>

          {/* Title & Subtitle */}
          <View style={styles.headerBlock}>
            <Text style={[styles.title, { color: theme.text }]}>
              {isRejected ? 'Application Not Approved' : 'Application Under Review'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {isRejected
                ? 'Thank you for your interest. Unfortunately, your clinical counselor application was not approved at this time.'
                : 'Welcome to CounselCare! Your application has been submitted and is currently being verified by our clinical administration team.'}
            </Text>
          </View>

          {/* Application Details Summary */}
          <Card variant="raised" padding="four" style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Application Details</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isRejected ? '#FEE2E2' : theme.primarySoft,
                    borderColor: isRejected ? '#EF4444' : theme.primary,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isRejected ? '#DC2626' : theme.primary },
                  ]}>
                  {isRejected ? 'REJECTED' : 'PENDING REVIEW'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Applicant Name:</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{profile?.profile?.name || userName}</Text>
            </View>

            {profile?.license_number && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>License Number:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{profile.license_number}</Text>
              </View>
            )}

            {profile?.qualification && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Qualification:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{profile.qualification}</Text>
              </View>
            )}

            {isRejected && profile?.rejection_reason && (
              <View style={[styles.reasonBox, { backgroundColor: theme.surfaceSoft, borderColor: '#EF4444' }]}>
                <Text style={[styles.reasonTitle, { color: '#DC2626' }]}>Reason for Rejection:</Text>
                <Text style={[styles.reasonText, { color: theme.text }]}>{profile.rejection_reason}</Text>
              </View>
            )}
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionBlock}>
            {!isRejected && (
              <Button
                label={loading ? 'Checking Status...' : 'Check Approval Status'}
                onPress={checkStatus}
                disabled={loading}
                style={styles.checkBtn}
              />
            )}

            <Pressable
              onPress={async () => {
                await logout();
                router.replace('/(auth)/login');
              }}
              style={[styles.logoutBtn, { borderColor: theme.border }]}>
              <MaterialCommunityIcons name="logout" size={18} color={theme.textSecondary} />
              <Text style={[styles.logoutBtnText, { color: theme.textSecondary }]}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.four,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.body - 1,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    width: '100%',
    gap: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  statusBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: FontSize.caption - 1,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: FontSize.caption + 1,
  },
  detailValue: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.semibold,
  },
  reasonBox: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
    marginTop: Spacing.one,
  },
  reasonTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  reasonText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
  actionBlock: {
    width: '100%',
    gap: Spacing.two,
  },
  checkBtn: {
    borderRadius: BorderRadius.full,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  logoutBtnText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
});
