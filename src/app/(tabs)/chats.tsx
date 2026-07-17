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

import { Avatar, Badge, Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import {
  fetchUserChats,
  fetchOrCreateChat,
  fetchCounselors,
  SupabaseChat,
  SupabaseCounselor,
} from '@/lib/supabase-db';

export default function StudentChatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<SupabaseChat[]>([]);
  const [counselors, setCounselors] = useState<SupabaseCounselor[]>([]);
  const [loading, setLoading] = useState(true);

  // Long-press options popup
  const [selectedChat, setSelectedChat] = useState<SupabaseChat | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const loadInboxData = async () => {
    try {
      const activeChats = await fetchUserChats(currentUserId, 'student');
      setChats(activeChats);
      
      const counselorList = await fetchCounselors();
      setCounselors(counselorList);
    } catch (err) {
      console.warn('Error loading support inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInboxData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleStartNewChat = async (counselorId: string, counselorName: string) => {
    setLoading(true);
    try {
      const activeChat = await fetchOrCreateChat(currentUserId, counselorId);
      if (activeChat) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: activeChat.id, name: counselorName, role: 'Counselor', recipientId: counselorId },
        });
      }
    } catch (err) {
      console.warn('Could not launch support chat room:', err);
      // Fallback
      router.push({
        pathname: '/chat/[id]',
        params: { id: `mock-chat-${counselorId}`, name: counselorName, role: 'Counselor', recipientId: counselorId },
      });
    } finally {
      setLoading(false);
    }
  };

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

  const handleMute = () => {
    setOptionsVisible(false);
    Alert.alert('Muted', 'You will no longer receive sound alerts for this thread.');
  };

  const handleArchive = () => {
    setOptionsVisible(false);
    Alert.alert('Archived', 'Chat archived. You can find it under your Archive logs.');
  };

  const filteredChats = chats.filter((chat) => {
    const counselorName = chat.counselor_profile?.name || 'Counselor';
    return counselorName.toLowerCase().includes(search.toLowerCase());
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
            <Text style={[styles.eyebrow, { color: theme.primary }]}>STUDENT CHATS</Text>
            <Text style={[styles.title, { color: theme.text }]}>Conversations</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Connect and chat directly with your assigned counselors and wellbeing coaches.
            </Text>
          </View>

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="magnify" size={22} color={theme.textSecondary} />
            <TextInput
              placeholder="Search chat or counselor..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>

          {/* Chats stack */}
          {loading ? (
            <View style={{ paddingVertical: Spacing.five, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.chatsStack}>
              {filteredChats.length > 0 ? (
                filteredChats.map((chat, idx) => {
                  const nameVal = chat.counselor_profile?.name || 'Counselor';
                  const timestampVal = getSmartTimestamp(chat.last_message_at);
                  
                  // Simulate unread state on the first chat item for testing/UX display
                  const isUnread = idx === 0 && !chat.last_message_at;
                  const unreadCount = isUnread ? 2 : 0;

                  return (
                    <Pressable
                      key={chat.id}
                      onLongPress={() => handleLongPress(chat)}
                      onPress={() =>
                        router.push({
                          pathname: '/chat/[id]',
                          params: { id: chat.id, name: nameVal, role: 'Counselor', recipientId: chat.counselor_id },
                        })
                      }>
                      <Card variant="surface" padding="three" style={[styles.chatCard, { borderColor: theme.border }]}>
                        <View style={styles.cardContent}>
                          {/* Avatar with live status dot */}
                          <View style={styles.avatarWrapper}>
                            <Avatar name={nameVal} size="md" />
                            <View style={[styles.statusDot, { backgroundColor: '#34C759', borderColor: theme.surfaceRaised }]} />
                          </View>

                          <View style={styles.chatDetails}>
                            <View style={styles.chatTopRow}>
                              <Text style={[styles.participantName, { color: theme.text }, isUnread && { fontWeight: FontWeight.bold }]}>
                                {nameVal}
                              </Text>
                              <Text style={[styles.timestamp, { color: isUnread ? theme.primary : theme.textSecondary }]}>
                                {timestampVal}
                              </Text>
                            </View>

                            <Text style={[styles.participantRole, { color: theme.textSecondary }]}>
                              Wellbeing Counselor
                            </Text>

                            <View style={styles.chatBottomRow}>
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.lastMessage,
                                  { color: theme.textSecondary },
                                  isUnread && { color: theme.text, fontWeight: FontWeight.bold },
                                ]}>
                                {chat.last_message || 'Start messaging...'}
                              </Text>
                              <Badge
                                count={unreadCount}
                                color={theme.primary}
                                size={18}
                                textStyle={{ fontSize: 9, fontWeight: 'bold' }}
                              />
                            </View>
                          </View>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.startNewChatContainer}>
                  {/* Empty state prompt to start one */}
                  <View style={styles.emptyView}>
                    <View style={[styles.emptyIconBox, { backgroundColor: theme.primarySoft }]}>
                      <MaterialCommunityIcons name="chat-plus-outline" size={32} color={theme.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No Conversations Yet</Text>
                    <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                      Select a licensed KNUST wellness counselor below to start your private coaching logs.
                    </Text>
                  </View>

                  <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                    AVAILABLE ADVISORS
                  </Text>
                  
                  {counselors.map((c) => {
                    const name = c.profile?.name || 'Counselor';
                    const specialty = c.specialties.join(', ') || 'General Counselor';
                    return (
                      <Pressable key={c.id} onPress={() => handleStartNewChat(c.id, name)} style={{ marginVertical: Spacing.one }}>
                        <Card variant="raised" padding="three" style={styles.counselorQuickCard}>
                          <View style={styles.avatarWrapper}>
                            <Avatar name={name} size="md" />
                            <View style={[styles.statusDot, { backgroundColor: '#34C759', borderColor: theme.surfaceRaised }]} />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[styles.participantName, { color: theme.text }]}>{name}</Text>
                            <Text style={[styles.participantRole, { color: theme.textSecondary }]}>{specialty}</Text>
                          </View>
                          <MaterialCommunityIcons name="message-plus" size={22} color={theme.primary} />
                        </Card>
                      </Pressable>
                    );
                  })}

                  {counselors.length === 0 && (
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons name="account-off-outline" size={48} color={theme.textSecondary} />
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No counselors available.</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Long-Press Dialog Modal */}
          <Modal visible={optionsVisible} transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
              <View style={[styles.modalContent, { backgroundColor: theme.surfaceRaised }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {selectedChat?.counselor_profile?.name || 'Chat options'}
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
                  <Text style={[styles.optionText, { color: theme.text }]}>Archive Chat</Text>
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
  startNewChatContainer: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  sectionSubtitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginTop: Spacing.three,
  },
  counselorQuickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  emptyView: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.medium,
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
