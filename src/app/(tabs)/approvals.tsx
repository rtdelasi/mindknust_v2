import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BorderRadius, FontSize, FontWeight, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { supabase } from '@/lib/supabase';
import {
  fetchCounselorProfilesByStatus,
  updateCounselorApprovalStatus,
  SupabaseCounselorProfile,
} from '@/lib/supabase-db';

export default function AdminApprovalsTabScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const currentUserId = auth?.currentUser?.uid || 'admin-user';

  // Sub-filter tabs: pending | approved | rejected
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [counselorsList, setCounselorsList] = useState<SupabaseCounselorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab Counts for Segment Pills
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  // Detail Modal State
  const [selectedCounselor, setSelectedCounselor] = useState<SupabaseCounselorProfile | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [expandedImageVisible, setExpandedImageVisible] = useState(false);

  // Rejection Reason Modal State
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Success Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch current active tab list
      const listData = await fetchCounselorProfilesByStatus(activeTab);
      setCounselorsList(listData);

      // 2. Fetch counts for all 3 categories
      const pendingData = await fetchCounselorProfilesByStatus('pending');
      const approvedData = await fetchCounselorProfilesByStatus('approved');
      const rejectedData = await fetchCounselorProfilesByStatus('rejected');

      setCounts({
        pending: pendingData.length,
        approved: approvedData.length,
        rejected: rejectedData.length,
      });
    } catch (e) {
      console.warn('Error loading counselor applications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  // Realtime subscription to counselor_profiles updates
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('admin_counselor_approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'counselor_profiles' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // -------------------------------------------------------------
  // ACTIONS: APPROVE & REJECT WITH CONFIRMATION STEPS
  // -------------------------------------------------------------
  const handleApproveConfirm = (counselor: SupabaseCounselorProfile) => {
    const applicantName = counselor.profile?.name || 'this counselor';
    Alert.alert(
      'Approve Counselor Application',
      `Are you sure you want to approve ${applicantName}? They will immediately gain access to student counseling features.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve Application',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              const success = await updateCounselorApprovalStatus(
                counselor.user_id,
                'approved',
                undefined,
                currentUserId
              );
              if (success) {
                setDetailModalVisible(false);
                setSelectedCounselor(null);
                showToast(`✓ ${applicantName} has been approved successfully.`);
                await loadData();
              } else {
                Alert.alert('Approval Failed', 'Unable to update approval status in database.');
              }
            } catch (e) {
              console.warn('Approve error:', e);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenRejectModal = (counselor: SupabaseCounselorProfile) => {
    setSelectedCounselor(counselor);
    setRejectionReason('');
    setRejectionModalVisible(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedCounselor) return;
    const applicantName = selectedCounselor.profile?.name || 'this counselor';

    Alert.alert(
      'Confirm Rejection',
      `Are you sure you want to reject the application for ${applicantName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Application',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const success = await updateCounselorApprovalStatus(
                selectedCounselor.user_id,
                'rejected',
                rejectionReason.trim() || 'Qualifications or credentials did not meet criteria.',
                currentUserId
              );
              if (success) {
                setRejectionModalVisible(false);
                setDetailModalVisible(false);
                setSelectedCounselor(null);
                showToast(`Application for ${applicantName} set to rejected.`);
                await loadData();
              } else {
                Alert.alert('Rejection Failed', 'Unable to update approval status.');
              }
            } catch (e) {
              console.warn('Reject error:', e);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const openDocumentViewer = async (url: string) => {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        await WebBrowser.openBrowserAsync(url);
      } else {
        setExpandedImageVisible(true);
      }
    } catch {
      setExpandedImageVisible(true);
    }
  };

  // -------------------------------------------------------------
  // ACCESS CONTROL GUARD FOR NON-ADMIN USERS
  // -------------------------------------------------------------
  if (role !== 'admin') {
    return (
      <View style={[styles.screen, styles.centerView, { backgroundColor: theme.background }]}>
        <View style={[styles.lockCircle, { backgroundColor: theme.primarySoft }]}>
          <MaterialCommunityIcons name="shield-lock" size={48} color={theme.primary} />
        </View>
        <Text style={[styles.accessDeniedTitle, { color: theme.text }]}>Access Restricted</Text>
        <Text style={[styles.accessDeniedSub, { color: theme.textSecondary }]}>
          Counselor application review and verification controls are restricted to authorized CounselCare clinical administrators.
        </Text>
        <Button
          label="Return to Dashboard"
          onPress={() => router.replace('/')}
          style={{ marginTop: Spacing.four }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <View style={[styles.toastBanner, { backgroundColor: '#10B981', top: insets.top + 10 }]}>
          <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: insets.top + Spacing.two, borderBottomColor: theme.border }]}>
        <View style={styles.titleBlock}>
          <Text style={[styles.topTitle, { color: theme.text }]}>Counselor Approvals</Text>
          <Text style={[styles.topSub, { color: theme.textSecondary }]}>
            Review credentials & verify clinical staff
          </Text>
        </View>
        <Pressable onPress={loadData} style={[styles.iconBtn, { backgroundColor: theme.surface }]}>
          <MaterialCommunityIcons name="refresh" size={20} color={theme.primary} />
        </Pressable>
      </View>

      {/* Segmented Filter Pills */}
      <View style={[styles.segmentContainer, { backgroundColor: theme.surfaceMuted }]}>
        <Pressable
          onPress={() => setActiveTab('pending')}
          style={[styles.segmentBtn, activeTab === 'pending' && { backgroundColor: theme.surfaceRaised, ...Shadows.light.small }]}>
          <Text style={[styles.segmentLabel, { color: activeTab === 'pending' ? theme.primary : theme.textSecondary }]}>
            Pending
          </Text>
          {counts.pending > 0 && (
            <View style={[styles.countBadge, { backgroundColor: '#FF3B30' }]}>
              <Text style={styles.countBadgeText}>{counts.pending > 9 ? '9+' : counts.pending}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('approved')}
          style={[styles.segmentBtn, activeTab === 'approved' && { backgroundColor: theme.surfaceRaised, ...Shadows.light.small }]}>
          <Text style={[styles.segmentLabel, { color: activeTab === 'approved' ? theme.primary : theme.textSecondary }]}>
            Approved
          </Text>
          {counts.approved > 0 && (
            <View style={[styles.countBadge, { backgroundColor: '#34C759' }]}>
              <Text style={styles.countBadgeText}>{counts.approved}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('rejected')}
          style={[styles.segmentBtn, activeTab === 'rejected' && { backgroundColor: theme.surfaceRaised, ...Shadows.light.small }]}>
          <Text style={[styles.segmentLabel, { color: activeTab === 'rejected' ? theme.primary : theme.textSecondary }]}>
            Rejected
          </Text>
          {counts.rejected > 0 && (
            <View style={[styles.countBadge, { backgroundColor: theme.textSecondary }]}>
              <Text style={styles.countBadgeText}>{counts.rejected}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Main Content List */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
        {loading ? (
          <View style={styles.loadingView}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Fetching {activeTab} counselor applications...
            </Text>
          </View>
        ) : counselorsList.length === 0 ? (
          <View style={styles.emptyView}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons
                name={activeTab === 'pending' ? 'check-all' : activeTab === 'approved' ? 'account-check' : 'account-remove'}
                size={40}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Applications
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              {activeTab === 'pending'
                ? 'All submitted counselor credentials have been verified and processed.'
                : `There are currently no ${activeTab} counselor records in the system.`}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {counselorsList.map((item) => {
              const name = item.profile?.name || 'Counselor Applicant';
              const email = item.profile?.email || 'N/A';
              const createdDate = item.created_at
                ? new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Recently';

              return (
                <Pressable
                  key={item.user_id}
                  onPress={() => {
                    setSelectedCounselor(item);
                    setDetailModalVisible(true);
                  }}>
                  <Card variant="raised" padding="four" style={styles.cardItem}>
                    <View style={styles.cardHeaderRow}>
                      <Avatar
                        name={name}
                        size="md"
                        source={item.photo_url || item.profile?.avatar_url ? { uri: item.photo_url || item.profile?.avatar_url } : undefined}
                      />
                      <View style={styles.applicantInfo}>
                        <Text style={[styles.applicantName, { color: theme.text }]}>{name}</Text>
                        <Text style={[styles.applicantEmail, { color: theme.textSecondary }]}>{email}</Text>
                        <Text style={[styles.appliedDate, { color: theme.textSecondary }]}>Applied: {createdDate}</Text>
                      </View>

                      {/* Status Pill */}
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor:
                              item.approval_status === 'approved'
                                ? '#E6F4EA'
                                : item.approval_status === 'rejected'
                                ? '#FEE2E2'
                                : '#FEF3C7',
                            borderColor:
                              item.approval_status === 'approved'
                                ? '#34C759'
                                : item.approval_status === 'rejected'
                                ? '#EF4444'
                                : '#D97706',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.statusPillText,
                            {
                              color:
                                item.approval_status === 'approved'
                                  ? '#15803D'
                                  : item.approval_status === 'rejected'
                                  ? '#B91C1C'
                                  : '#B45309',
                            },
                          ]}>
                          {item.approval_status ? item.approval_status.toUpperCase() : 'PENDING'}
                        </Text>
                      </View>
                    </View>

                    {/* License & Qualifications Summary */}
                    <View style={[styles.summaryBox, { backgroundColor: theme.surfaceSoft }]}>
                      <Text style={[styles.summaryText, { color: theme.text }]}>
                        <Text style={{ fontWeight: FontWeight.bold }}>License: </Text>
                        {item.license_number}
                      </Text>
                      <Text style={[styles.summaryText, { color: theme.text }]}>
                        <Text style={{ fontWeight: FontWeight.bold }}>Degree: </Text>
                        {item.qualification}
                      </Text>
                    </View>

                    {/* Specialization Pills */}
                    {item.specializations && item.specializations.length > 0 && (
                      <View style={styles.tagWrap}>
                        {item.specializations.slice(0, 3).map((spec, idx) => (
                          <View key={idx} style={[styles.specTag, { backgroundColor: theme.primarySoft }]}>
                            <Text style={[styles.specTagText, { color: theme.primary }]}>{spec}</Text>
                          </View>
                        ))}
                        {item.specializations.length > 3 && (
                          <Text style={[styles.moreTagText, { color: theme.textSecondary }]}>
                            +{item.specializations.length - 3} more
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Quick Review Link */}
                    <View style={styles.reviewLinkRow}>
                      <Text style={[styles.reviewLinkText, { color: theme.primary }]}>Review Full Credentials & Bio</Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={theme.primary} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* APPLICATION DETAIL / REVIEW SCREEN MODAL */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Modal visible={detailModalVisible} animationType="slide" presentationStyle="pageSheet">
        {selectedCounselor && (
          <View style={[styles.screen, { backgroundColor: theme.background }]}>
            {/* Modal Header */}
            <View style={[styles.topHeader, { paddingTop: Spacing.three, borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setDetailModalVisible(false)} style={styles.iconBtn}>
                <MaterialCommunityIcons name="close" size={24} color={theme.text} />
              </Pressable>
              <Text style={[styles.topTitle, { color: theme.text }]}>Application Review</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Profile Card Header */}
              <View style={[styles.detailProfileCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                <Avatar
                  name={selectedCounselor.profile?.name || 'Applicant'}
                  size="xl"
                  source={
                    selectedCounselor.photo_url || selectedCounselor.profile?.avatar_url
                      ? { uri: selectedCounselor.photo_url || selectedCounselor.profile?.avatar_url }
                      : undefined
                  }
                />
                <Text style={[styles.detailName, { color: theme.text }]}>
                  {selectedCounselor.profile?.name || 'Counselor Applicant'}
                </Text>
                <Text style={[styles.detailEmail, { color: theme.textSecondary }]}>
                  {selectedCounselor.profile?.email || 'N/A'}
                </Text>

                <View
                  style={[
                    styles.statusPill,
                    {
                      marginTop: Spacing.two,
                      backgroundColor:
                        selectedCounselor.approval_status === 'approved'
                          ? '#E6F4EA'
                          : selectedCounselor.approval_status === 'rejected'
                          ? '#FEE2E2'
                          : '#FEF3C7',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color:
                          selectedCounselor.approval_status === 'approved'
                            ? '#15803D'
                            : selectedCounselor.approval_status === 'rejected'
                            ? '#B91C1C'
                            : '#B45309',
                      },
                    ]}>
                    STATUS: {selectedCounselor.approval_status ? selectedCounselor.approval_status.toUpperCase() : 'PENDING'}
                  </Text>
                </View>
              </View>

              {/* Credentials Section */}
              <View style={[styles.sectionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CLINICAL CREDENTIALS</Text>

                <View style={styles.detailRow}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>License / Certification #</Text>
                  <Text style={[styles.fieldValue, { color: theme.text }]}>{selectedCounselor.license_number}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Institution / Qualification</Text>
                  <Text style={[styles.fieldValue, { color: theme.text }]}>{selectedCounselor.qualification}</Text>
                </View>

                {/* Credential Document Preview / Inspector */}
                {selectedCounselor.credential_document_url ? (
                  <View style={styles.docInspectBox}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Uploaded Credential Document</Text>
                    {selectedCounselor.credential_document_url.startsWith('http') ? (
                      <Pressable
                        onPress={() => openDocumentViewer(selectedCounselor.credential_document_url!)}
                        style={[styles.docLinkBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                        <MaterialCommunityIcons name="file-document-outline" size={22} color={theme.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.docLinkTitle, { color: theme.primary }]}>Inspect Uploaded Credential Document</Text>
                          <Text style={[styles.docLinkSub, { color: theme.textSecondary }]}>Tap to view PDF / full resolution image</Text>
                        </View>
                        <MaterialCommunityIcons name="open-in-new" size={18} color={theme.primary} />
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => setExpandedImageVisible(true)}>
                        <Image source={{ uri: selectedCounselor.credential_document_url }} style={styles.docImagePreview} />
                        <Text style={[styles.expandHint, { color: theme.primary }]}>Tap image to expand</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <View style={styles.detailRow}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Credential Document</Text>
                    <Text style={[styles.fieldValue, { color: theme.textSecondary }]}>No document uploaded</Text>
                  </View>
                )}
              </View>

              {/* Specializations & Bio Section */}
              <View style={[styles.sectionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PRACTICE & SPECIALIZATIONS</Text>

                <View style={styles.tagWrap}>
                  {selectedCounselor.specializations?.map((spec, i) => (
                    <View key={i} style={[styles.specTag, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.specTagText, { color: theme.primary }]}>{spec}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.two }]}>Professional Bio</Text>
                <Text style={[styles.bioBody, { color: theme.text }]}>
                  {selectedCounselor.bio || 'No bio provided by applicant.'}
                </Text>
              </View>

              {/* Availability Schedule */}
              <View style={[styles.sectionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SUBMITTED AVAILABILITY SCHEDULE</Text>
                {selectedCounselor.availability && selectedCounselor.availability.length > 0 ? (
                  <View style={styles.availGrid}>
                    {selectedCounselor.availability.map((slot, idx) => (
                      <View key={idx} style={[styles.availPill, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={theme.primary} />
                        <Text style={[styles.availText, { color: theme.text }]}>
                          {slot.day}: {slot.start} - {slot.end}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.fieldValue, { color: theme.textSecondary }]}>
                    Default Hours (Mon, Wed, Fri · 9:00 AM - 5:00 PM)
                  </Text>
                )}
              </View>

              {/* Audit Metadata (Rejection Reason / Submission Date) */}
              <View style={[styles.sectionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPLICATION METADATA & AUDIT</Text>
                <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                  Applied On: {selectedCounselor.created_at ? new Date(selectedCounselor.created_at).toLocaleString() : 'N/A'}
                </Text>
                {selectedCounselor.reviewed_at && (
                  <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                    Reviewed On: {new Date(selectedCounselor.reviewed_at).toLocaleString()}
                  </Text>
                )}
                {selectedCounselor.rejection_reason && (
                  <View style={[styles.rejectionReasonCard, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                    <Text style={[styles.fieldLabel, { color: '#B91C1C' }]}>Rejection Rationale:</Text>
                    <Text style={[styles.summaryText, { color: '#991B1B' }]}>{selectedCounselor.rejection_reason}</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtonContainer}>
                {selectedCounselor.approval_status !== 'approved' && (
                  <Pressable
                    onPress={() => handleApproveConfirm(selectedCounselor)}
                    disabled={actionLoading}
                    style={[styles.approveFullBtn, { backgroundColor: '#10B981' }]}>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Approve Counselor</Text>
                  </Pressable>
                )}

                {selectedCounselor.approval_status !== 'rejected' && (
                  <Pressable
                    onPress={() => handleOpenRejectModal(selectedCounselor)}
                    disabled={actionLoading}
                    style={[styles.rejectFullBtn, { backgroundColor: '#EF4444' }]}>
                    <MaterialCommunityIcons name="close-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Reject Application</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* REJECTION REASON INPUT MODAL */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Modal visible={rejectionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card variant="raised" padding="four" style={[styles.modalCard, { backgroundColor: theme.surfaceRaised }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Reject Application</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Enter a rejection rationale for {selectedCounselor?.profile?.name || 'this applicant'}:
            </Text>

            <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.surfaceSoft }]}>
              <TextInput
                placeholder="e.g. License verification failed / Document unreadable"
                placeholderTextColor={theme.textSecondary}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { color: theme.text }]}
              />
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setRejectionModalVisible(false);
                }}
                style={[styles.cancelBtn, { borderColor: theme.border }]}>
                <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleRejectConfirm}
                disabled={actionLoading}
                style={[styles.confirmRejectBtn, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.confirmRejectText}>{actionLoading ? 'Processing...' : 'Confirm Rejection'}</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Expanded Document Image Viewer */}
      <Modal visible={expandedImageVisible} transparent animationType="fade">
        <View style={styles.fullImageOverlay}>
          <Pressable onPress={() => setExpandedImageVisible(false)} style={styles.closeImageBtn}>
            <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {selectedCounselor?.credential_document_url && (
            <Image
              source={{ uri: selectedCounselor.credential_document_url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerView: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  lockCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  accessDeniedTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  accessDeniedSub: {
    fontSize: FontSize.body,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },

  /* Toast Banner */
  toastBanner: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    zIndex: 9999,
    ...Shadows.light.medium,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },

  /* Top Header */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  titleBlock: {
    gap: 2,
  },
  topTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  topSub: {
    fontSize: FontSize.caption,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Segment Pills */
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: BorderRadius.full,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  segmentLabel: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },

  /* Scroll Content & Cards */
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  loadingView: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: FontSize.caption + 1,
  },
  emptyView: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: Spacing.two,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  emptySub: {
    fontSize: FontSize.body - 1,
    textAlign: 'center',
    maxWidth: 300,
  },
  listContainer: {
    gap: Spacing.three,
  },
  cardItem: {
    gap: Spacing.two,
    borderRadius: BorderRadius.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  applicantInfo: {
    flex: 1,
    gap: 2,
  },
  applicantName: {
    fontSize: FontSize.h3 - 2,
    fontWeight: FontWeight.bold,
  },
  applicantEmail: {
    fontSize: FontSize.caption,
  },
  appliedDate: {
    fontSize: FontSize.small,
  },
  statusPill: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.bold,
  },
  summaryBox: {
    padding: Spacing.two,
    borderRadius: BorderRadius.md,
    gap: 2,
  },
  summaryText: {
    fontSize: FontSize.caption + 1,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  specTag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  specTagText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  moreTagText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
  },
  reviewLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  reviewLinkText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },

  /* Detail Modal */
  modalScrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: 60,
  },
  detailProfileCard: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  detailName: {
    fontSize: FontSize.h2 - 2,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.two,
  },
  detailEmail: {
    fontSize: FontSize.caption + 1,
  },
  sectionBlock: {
    padding: Spacing.four,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  detailRow: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  fieldValue: {
    fontSize: FontSize.body - 1,
  },
  docInspectBox: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  docLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  docLinkTitle: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  docLinkSub: {
    fontSize: FontSize.small,
  },
  docImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    resizeMode: 'cover',
  },
  expandHint: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
    marginTop: 4,
    textAlign: 'center',
  },
  bioBody: {
    fontSize: FontSize.body - 1,
    lineHeight: 20,
  },
  availGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  availPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  availText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  rejectionReasonCard: {
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
    marginTop: Spacing.two,
  },
  actionButtonContainer: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  approveFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: Size.buttonHeight,
    borderRadius: BorderRadius.full,
  },
  rejectFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: Size.buttonHeight,
    borderRadius: BorderRadius.full,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },

  /* Rejection Reason Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    gap: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  modalTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  modalSub: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.two,
  },
  textArea: {
    fontSize: FontSize.body - 1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  confirmRejectBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  confirmRejectText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },

  /* Expanded Image Modal */
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
});
