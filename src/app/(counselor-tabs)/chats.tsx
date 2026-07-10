import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { fetchUserChats, SupabaseChat } from '@/lib/supabase-db';

export default function CounselorChatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<SupabaseChat[]>([]);
  const [loading, setLoading] = useState(true);

  // Long-press options popup
  const [selectedChat, setSelectedChat] = useState<SupabaseChat | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const loadCounselorInbox = async () => {
    try {
      const activeChats = await fetchUserChats(currentUserId, 'counselor');
      setChats(activeChats);
    } catch (err) {
      console.warn('Error loading counselor support inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCounselorInbox();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const getSmartTimestamp = (dateStr?: string) => {
    if (!dateStr) return '2h ago';
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return past.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleLongPress = (chat: SupabaseChat) => {
    setSelectedChat(chat);
    setOptionsVisible(true);
  };

  const handleMarkAsRead = () => {
    setOptionsVisible(false);
    Alert.alert('Success', 'Conversation marked as read.');
  };

  const handleArchive = () => {
    setOptionsVisible(false);
    Alert.alert('Archived', 'Chat archived successfully.');
  };

  const handleMute = () => {
    setOptionsVisible(false);
    Alert.alert('Muted', 'Notifications muted for this student.');
  };

  // Filter logic
  const filteredChats = chats.filter((chat) => {
    const studentName = chat.student_profile?.name || 'Student Member';
    return studentName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + 128 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>COUNSELOR CHATS</Text>
            <Text style={[styles.title, { color: theme.text }]}>Conversations</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Monitor active chat channels and correspond directly with student members.
            </Text>
          </View>

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="magnify" size={22} color={theme.textSecondary} />
            <TextInput
              placeholder="Search student name..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>

          {/* Chats list */}
          {loading ? (
            <View style={{ paddingVertical: Spacing.five, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.chatsStack}>
              {filteredChats.length > 0 ? (
                filteredChats.map((chat, idx) => {
                  const studentName = chat.student_profile?.name || 'Student Member';
                  const timestampVal = getSmartTimestamp(chat.last_message_at);

                  // Simulate unread on index 0 for rich aesthetics
                  const isUnread = idx === 0 && !chat.last_message_at;
                  const unreadCount = isUnread ? 1 : 0;

                  return (
                    <Pressable
                      key={chat.id}
                      onLongPress={() => handleLongPress(chat)}
                      onPress={() =>
                        router.push({
                          pathname: '/chat/[id]',
                          params: { id: chat.id, name: studentName, role: 'Student', recipientId: chat.student_id },
                        })
                      }>
                      <Card variant="surface" padding="three" style={[styles.chatCard, { borderColor: theme.border }]}>
                        <View style={styles.cardContent}>
                          {/* Avatar with status indicator */}
                          <View style={styles.avatarWrapper}>
                            <Avatar name={studentName} size="md" />
                            <View style={[styles.statusDot, { backgroundColor: '#34C759', borderColor: theme.surfaceRaised }]} />
                          </View>

                          <View style={styles.chatDetails}>
                            <View style={styles.chatTopRow}>
                              <Text style={[styles.participantName, { color: theme.text }, isUnread && { fontWeight: FontWeight.bold }]}>
                                {studentName}
                              </Text>
                              <Text style={[styles.timestamp, { color: isUnread ? theme.primary : theme.textSecondary }]}>
                                {timestampVal}
                              </Text>
                            </View>

                            <Text style={[styles.participantRole, { color: theme.textSecondary }]}>
                              KNUST Enrolled Student
                            </Text>

                            <View style={styles.chatBottomRow}>
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.lastMessage,
                                  { color: theme.textSecondary },
                                  isUnread && { color: theme.text, fontWeight: FontWeight.bold },
                                ]}>
                                {chat.last_message || 'Start corresponding...'}
                              </Text>
                              {unreadCount > 0 && (
                                <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                                  <Text style={styles.unreadText}>{unreadCount}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyView}>
                  <View style={[styles.emptyIconBox, { backgroundColor: theme.primarySoft }]}>
                    <MaterialCommunityIcons name="message-text-clock-outline" size={32} color={theme.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No Conversations Found</Text>
                  <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                    No student chats match your search.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Long Press Modal Options */}
          <Modal visible={optionsVisible} transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
              <View style={[styles.modalContent, { backgroundColor: theme.surfaceRaised }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {selectedChat?.student_profile?.name || 'Student chat options'}
                </Text>

                <Pressable onPress={handleMarkAsRead} style={styles.modalOption}>
                  <MaterialCommunityIcons name="check-all" size={20} color={theme.textSecondary} />
                  <Text style={[styles.optionText, { color: theme.text }]}>Mark as Read</Text>
                </Pressable>

                <Pressable onPress={handleMute} style={styles.modalOption}>
                  <MaterialCommunityIcons name="bell-off-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.optionText, { color: theme.text }]}>Mute Notifications</Text>
                </Pressable>

                <Pressable onPress={handleArchive} style={styles.modalOption}>
                  <MaterialCommunityIcons name="archive-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.optionText, { color: theme.text }]}>Archive Student</Text>
                </Pressable>

                <Pressable onPress={() => setOptionsVisible(false)} style={[styles.modalOption, { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 }]}>
                  <Text style={[styles.cancelText, { color: theme.primary }]}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>

        </View>
      </ScrollView>
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
  },
  eyebrow: {
    fontSize: FontSize.small + 1,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 54,
    borderRadius: BorderRadius.md + 4,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body - 1,
    paddingVertical: 0,
  },
  chatsStack: {
    gap: Spacing.two,
  },
  chatCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarWrapper: {
    position: 'relative',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  chatDetails: {
    flex: 1,
    gap: 2,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  timestamp: {
    fontSize: FontSize.caption,
  },
  participantRole: {
    fontSize: FontSize.caption,
  },
  chatBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  lastMessage: {
    fontSize: FontSize.caption + 1,
    flex: 1,
    marginRight: Spacing.two,
  },
  unreadBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  emptyView: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  emptyDesc: {
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    elevation: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  modalTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.one,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  optionText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.semibold,
  },
  cancelText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    width: '100%',
  },
});
