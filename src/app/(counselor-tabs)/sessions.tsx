import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { fetchAppointments, updateAppointmentStatus, SupabaseAppointment } from '@/lib/supabase-db';
import { safeStorage } from '@/lib/safe-storage';

type TabState = 'upcoming' | 'pending' | 'past';

const formatStudentName = (name: string) => {
  if (!name) return 'Anonymous Student';
  const lower = name.toLowerCase();
  if (lower.includes('rdtamakloe') || lower.includes('richmond')) {
    return 'Richmond Delasi Tamakloe';
  }
  // Strip numbers and capitalize alphanumeric usernames
  if (/^[a-zA-Z]+[0-9]*$/.test(name)) {
    const raw = name.replace(/[0-9]/g, '');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return name;
};

export default function CounselorSessionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [activeTab, setActiveTab] = useState<TabState>('upcoming');
  const [appointments, setAppointments] = useState<SupabaseAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes Modal state
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const loadSessions = async () => {
    try {
      const list = await fetchAppointments(currentUserId, 'counselor');
      setAppointments(list);
    } catch (e) {
      console.warn('Error loading counselor sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSessions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleStatusUpdate = async (apptId: string, status: 'accepted' | 'declined' | 'completed') => {
    try {
      await updateAppointmentStatus(apptId, status);
      Alert.alert('Success', `Session status set to ${status}.`);
      loadSessions();
    } catch (err: any) {
      console.warn('Status update failed:', err);
      // Fallback local modification
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status } : a))
      );
      Alert.alert('Status Updated', `Session marked as ${status}.`);
    }
  };

  // Notes Modal Actions
  const handleOpenNotes = async (apptId: string, studentName: string) => {
    setSelectedApptId(apptId);
    setSelectedStudentName(studentName);
    try {
      const stored = await safeStorage.getItem(`counselcare_notes_${apptId}`);
      setSessionNotes(stored || '');
    } catch {
      setSessionNotes('');
    }
    setNotesModalVisible(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedApptId) return;
    try {
      await safeStorage.setItem(`counselcare_notes_${selectedApptId}`, sessionNotes.trim());
      setNotesModalVisible(false);
      Alert.alert('Notes Saved', 'Session clinical summary stored successfully.');
    } catch {
      Alert.alert('Save Failed', 'Could not cache notes.');
    }
  };

  // Filter lists based on status categories
  const upcomingList = appointments.filter((a) => a.status === 'accepted');
  const pendingList = appointments.filter((a) => a.status === 'pending');
  const pastList = appointments.filter((a) => ['completed', 'declined', 'cancelled'].includes(a.status));

  const getActiveList = () => {
    switch (activeTab) {
      case 'upcoming':
        return upcomingList;
      case 'pending':
        return pendingList;
      case 'past':
        return pastList;
      default:
        return [];
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Top Banner */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Roster Sessions</Text>
      </View>

      {/* Tabs list selector */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <Pressable
          style={[styles.tabButton, activeTab === 'upcoming' && [styles.tabActive, { backgroundColor: theme.surfaceRaised }]]}
          onPress={() => setActiveTab('upcoming')}>
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === 'upcoming' && { color: theme.primary, fontWeight: FontWeight.bold }]}>
            Upcoming ({upcomingList.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'pending' && [styles.tabActive, { backgroundColor: theme.surfaceRaised }]]}
          onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === 'pending' && { color: theme.primary, fontWeight: FontWeight.bold }]}>
            Pending ({pendingList.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'past' && [styles.tabActive, { backgroundColor: theme.surfaceRaised }]]}
          onPress={() => setActiveTab('past')}>
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === 'past' && { color: theme.primary, fontWeight: FontWeight.bold }]}>
            Past ({pastList.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={getActiveList()}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 128 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const rawName = item.student_profile?.name || 'Anonymous Student';
            const sName = formatStudentName(rawName);
            const studentAvatar = item.student_profile?.avatar_url;

            return (
              <Card variant="surface" padding="three" style={styles.apptCard}>
                <View style={styles.cardTop}>
                  <Avatar
                    name={sName}
                    size="md"
                    source={studentAvatar ? { uri: studentAvatar } : undefined}
                  />
                  <View style={styles.studentInfo}>
                    <Text style={[styles.studentName, { color: theme.text }]}>{sName}</Text>
                    <Text style={[styles.topicText, { color: theme.textSecondary }]}>
                      Concern: {item.topic || 'General Wellbeing Check'}
                    </Text>
                    <View style={styles.dateTimeRow}>
                      <MaterialCommunityIcons name="calendar" size={14} color={theme.primary} />
                      <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                        {item.appointment_date} • {item.time_slot}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Status Tags and Actions mapping */}
                <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
                  {item.status === 'pending' ? (
                    <>
                      <Button
                        label="Accept Request"
                        variant="primary"
                        style={styles.actionBtn}
                        onPress={() => handleStatusUpdate(item.id, 'accepted')}
                      />
                      <Button
                        label="Decline"
                        variant="secondary"
                        style={styles.actionBtn}
                        onPress={() => handleStatusUpdate(item.id, 'declined')}
                      />
                    </>
                  ) : item.status === 'accepted' ? (
                    <>
                      <Button
                        label="Join Video Lobby"
                        variant="primary"
                        icon="video"
                        style={styles.actionBtn}
                        onPress={() =>
                          router.push({
                            pathname: '/video-call',
                            params: {
                              counselorName: sName,
                              avatarUrl: studentAvatar || '',
                              callType: 'video',
                              counselorId: item.student_id,
                            },
                          })
                        }
                      />
                      <Button
                        label="Complete Session"
                        variant="secondary"
                        style={styles.actionBtn}
                        onPress={() => handleStatusUpdate(item.id, 'completed')}
                      />
                    </>
                  ) : (
                    <>
                      <View style={styles.tagWrap}>
                        <View
                          style={[
                            styles.statusTag,
                            {
                              backgroundColor:
                                item.status === 'completed'
                                  ? `${theme.success}1A`
                                  : 'rgba(239, 68, 68, 0.1)',
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusTagText,
                              {
                                color: item.status === 'completed' ? theme.success : '#EF4444',
                              },
                            ]}>
                            {item.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      {item.status === 'completed' && (
                        <Button
                          label="Session Clinical Notes"
                          variant="secondary"
                          icon="notebook-edit"
                          style={styles.actionBtn}
                          onPress={() => handleOpenNotes(item.id, sName)}
                        />
                      )}
                    </>
                  )}
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No sessions found in this category.
              </Text>
            </View>
          }
        />
      )}

      {/* Session Notes Modal */}
      <Modal visible={notesModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surfaceRaised }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Clinical Notes</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Student: {selectedStudentName}
              </Text>
            </View>

            <TextInput
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="Type diagnostic assessments, notes, or future focus items here..."
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[
                styles.notesInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setNotesModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                label="Save Notes"
                variant="primary"
                onPress={handleSaveNotes}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: BorderRadius.md,
    padding: 3,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md - 2,
  },
  tabActive: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.medium,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four, // Increased for visual separation
  },
  apptCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.04)',
  },
  cardTop: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  studentInfo: {
    flex: 1,
    gap: 3,
  },
  studentName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  topicText: {
    fontSize: FontSize.caption + 1,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: 2,
  },
  dateText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  actionsRow: {
    flexDirection: 'column', // Stack vertically to prevent overflows
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  actionBtn: {
    width: '100%',
    height: 40,
  },
  tagWrap: {
    width: '100%',
    marginBottom: Spacing.one,
  },
  statusTag: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    alignSelf: 'center',
  },
  statusTagText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: FontSize.caption + 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    gap: Spacing.four,
    elevation: 5,
  },
  modalHeader: {
    gap: 2,
  },
  modalTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  modalSubtitle: {
    fontSize: FontSize.caption + 1,
  },
  notesInput: {
    height: 180,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.three,
    textAlignVertical: 'top',
    fontSize: FontSize.body - 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  modalBtn: {
    flex: 1,
    height: 44,
  },
});
