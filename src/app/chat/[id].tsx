import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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

import { Avatar } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { supabase } from '@/lib/supabase';
import {
  fetchMessages,
  sendMessage as submitDbMessage,
  SupabaseMessage,
  markMessagesAsRead,
} from '@/lib/supabase-db';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  created_at: string;
  delivered_at?: string;
  read_at?: string;
}

export default function ChatRoomScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; role?: string; recipientId?: string }>();
  const chatId = params.id;
  const { role } = useMockAuth();

  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Realtime States
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserStatus, setOtherUserStatus] = useState<'Online' | 'Offline' | 'In session'>('Online');

  // Options Dropdown Menu
  const [menuVisible, setMenuVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const channelRef = useRef<any>(null);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');
  const recipientName = params.name || 'Wellbeing Advisor';
  const recipientRole = params.role || 'Counselor';
  const recipientId = params.recipientId || '';

  const loadChatThread = async () => {
    if (!chatId) return;
    try {
      const records = await fetchMessages(chatId);
      const mapped: ChatMessage[] = records.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_id === currentUserId ? 'You' : recipientName,
        text: m.text,
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        created_at: m.created_at,
        delivered_at: m.delivered_at,
        read_at: m.read_at,
      }));
      setMessages(mapped);
    } catch (err) {
      console.warn('Error loading chat messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initChat = async () => {
      await loadChatThread();
      if (chatId) {
        await markMessagesAsRead(chatId, currentUserId);
      }
    };
    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Realtime Presence / Subscription / Typing Indicators
  useEffect(() => {
    if (!chatId || !supabase) return;

    const channel = supabase
      .channel(`chat-room-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const insertMsg = payload.new as SupabaseMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === insertMsg.id)) return prev;
            
            const newMapped: ChatMessage = {
              id: insertMsg.id,
              senderId: insertMsg.sender_id,
              senderName: insertMsg.sender_id === currentUserId ? 'You' : recipientName,
              text: insertMsg.text,
              timestamp: new Date(insertMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              created_at: insertMsg.created_at,
              delivered_at: insertMsg.delivered_at,
              read_at: insertMsg.read_at,
            };

            // If incoming message from other user, automatically mark read
            if (insertMsg.sender_id !== currentUserId) {
              markMessagesAsRead(chatId, currentUserId);
            }

            return [...prev, newMapped];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as SupabaseMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedMsg.id
                ? {
                    ...m,
                    delivered_at: updatedMsg.delivered_at,
                    read_at: updatedMsg.read_at,
                  }
                : m
            )
          );
        }
      )
      .on('broadcast', { event: 'typing' }, (event) => {
        const payload = event.payload;
        if (payload.userId !== currentUserId) {
          setOtherUserTyping(payload.typing);
        }
      })
      .on('broadcast', { event: 'presence' }, (event) => {
        const payload = event.payload;
        if (payload.userId !== currentUserId) {
          setOtherUserStatus(payload.status);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'presence',
            payload: { userId: currentUserId, status: 'Online' },
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase!.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, currentUserId]);

  // Scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 200);
  }, [messages, otherUserTyping]);

  const handleTextChange = (val: string) => {
    setText(val);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, typing: val.length > 0 },
      });
    }
  };

  const handleSendMessage = async () => {
    if (!text.trim() || !chatId) return;
    const bodyText = text.trim();
    setText('');

    // Clear typing broadcast status
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, typing: false },
      });
    }

    // Optimistic Update
    const mockId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: mockId,
      senderId: currentUserId,
      senderName: 'You',
      text: bodyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: new Date().toISOString(),
      delivered_at: undefined,
      read_at: undefined,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const sent = await submitDbMessage(chatId, currentUserId, bodyText);
      if (sent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === mockId
              ? {
                  ...m,
                  id: sent.id,
                  created_at: sent.created_at,
                  delivered_at: sent.delivered_at,
                  read_at: sent.read_at,
                }
              : m
          )
        );
      }
    } catch (err) {
      console.warn('DB message submit failed, using fallback:', err);
    }
  };

  const handleBlockUser = () => {
    setMenuVisible(false);
    Alert.alert('User Blocked', 'This contact has been restricted. You will not receive any messages from them.');
  };

  const handleCrisisHotline = () => {
    Alert.alert(
      'KNUST Support Hotlines',
      `Need immediate psychiatric attention or suicide counselor intervention?\n\n• KNUST Helpline: 03220-60352\n• Ghana Crisis Line: +233 59 666 4444\n\nClick Call below to dial our support division.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Call Helpline', onPress: () => {} }]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      
      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <Avatar name={recipientName} size="sm" />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerName, { color: theme.text }]}>{recipientName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: otherUserStatus === 'Online' ? '#34C759' : '#8E8E93' }]} />
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                {recipientRole} • {otherUserStatus === 'Online' ? 'Active Now' : otherUserStatus}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            style={[styles.callButton, { backgroundColor: theme.primarySoft }]}
            onPress={() => router.push({ pathname: '/video-call', params: { counselorName: recipientName, counselorId: recipientId, callType: 'video' } })}>
            <MaterialCommunityIcons name="video" size={20} color={theme.primary} />
          </Pressable>
          <Pressable style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Safety / Crisis Banner (only for Student profile views) */}
      {role === 'student' && (
        <Pressable
          onPress={handleCrisisHotline}
          style={[styles.crisisBanner, { backgroundColor: '#FF3B3014', borderColor: '#FF3B3026' }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FF3B30" />
          <Text style={styles.crisisText}>Need urgent help? Tap for Crisis Support</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color="#FF3B30" />
        </Pressable>
      )}

      {/* Messages Scroll Area */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.messagesContainer, { paddingBottom: Spacing.four }]}
          style={styles.messageList}>
          <Text style={[styles.encryptionNotice, { color: theme.textSecondary }]}>
            🔒 End-to-end encrypted consultations. Your privacy is protected.
          </Text>

          {messages.map((msg, index) => {
            const isOutgoing = msg.senderId === currentUserId;
            
            // Check message groupings to collapse spacing for consecutive messages from same user
            const previousMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive = previousMsg && previousMsg.senderId === msg.senderId;

            // Date dividers grouping (Render date banner between different hours)
            const showDateDivider =
              !previousMsg ||
              new Date(msg.created_at).getTime() - new Date(previousMsg.created_at).getTime() > 1800000; // 30 mins gap

            // Check if this message is the most recent in a consecutive run of outgoing messages
            const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
            const isLastInRun = !nextMsg || nextMsg.senderId !== msg.senderId;
            const showReceipt = isOutgoing && isLastInRun;

            return (
              <View key={msg.id} style={{ width: '100%' }}>
                {showDateDivider && (
                  <View style={styles.dateDivider}>
                    <Text style={[styles.dateDividerText, { color: theme.textSecondary }]}>
                      {new Date(msg.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • {msg.timestamp}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.messageRow,
                    isOutgoing ? styles.outgoingRow : styles.incomingRow,
                    isConsecutive ? styles.consecutiveRowGap : styles.normalRowGap,
                  ]}>
                  {!isOutgoing && !isConsecutive ? (
                    <View style={styles.incomingAvatarWrapper}>
                      <Avatar name={recipientName} size="sm" />
                    </View>
                  ) : !isOutgoing ? (
                    <View style={styles.avatarPlaceholder} />
                  ) : null}

                  <View style={styles.bubbleWrapper}>
                    <View
                      style={[
                        styles.bubble,
                        isOutgoing
                          ? [styles.outgoingBubble, { backgroundColor: theme.primary }]
                          : [styles.incomingBubble, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }],
                      ]}>
                      <Text style={[styles.messageText, { color: isOutgoing ? '#FFFFFF' : theme.text }]}>
                        {msg.text}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Show read receipt under the most recent in a run */}
                {showReceipt && (
                  <Text style={[styles.readReceipt, { color: theme.textSecondary }]}>
                    {msg.read_at ? 'Seen' : msg.delivered_at ? 'Delivered' : 'Sent'}
                  </Text>
                )}
              </View>
            );
          })}

          {/* Realtime Typing Indicator */}
          {otherUserTyping && (
            <View style={[styles.messageRow, styles.incomingRow, styles.consecutiveRowGap]}>
              <View style={styles.incomingAvatarWrapper}>
                <Avatar name={recipientName} size="sm" />
              </View>
              <View style={[styles.bubble, styles.incomingBubble, { backgroundColor: theme.surfaceSoft, borderColor: theme.border, paddingVertical: 8 }]}>
                <Text style={{ fontStyle: 'italic', fontSize: FontSize.caption, color: theme.textSecondary }}>
                  {recipientName} is typing...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Input controls footer */}
      <View style={[styles.footerInput, { paddingBottom: Math.max(insets.bottom, Spacing.three), borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
        <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
          <Pressable
            style={styles.mediaButton}
            onPress={() => Alert.alert('Share Document', 'Integrations with Google DriveKNUST mailbox for clinical records sharing is locked.')}>
            <MaterialCommunityIcons name="paperclip" size={22} color={theme.textSecondary} />
          </Pressable>
          <TextInput
            placeholder="Type your message..."
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={handleTextChange}
            style={[styles.textInput, { color: theme.text }]}
          />
          <Pressable
            disabled={!text.trim()}
            onPress={handleSendMessage}
            style={[
              styles.sendButton,
              { backgroundColor: text.trim() ? theme.primary : `${theme.primary}33` },
            ]}>
            <MaterialCommunityIcons
              name="send"
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </View>

      {/* Options Header Dropdown Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.surfaceRaised }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Actions</Text>
            
            <Pressable
              onPress={() => {
                setMenuVisible(false);
                Alert.alert('Session History', `You have corresponding history logs with ${recipientName}.`);
              }}
              style={styles.modalOption}>
              <MaterialCommunityIcons name="history" size={20} color={theme.textSecondary} />
              <Text style={[styles.optionText, { color: theme.text }]}>View Session History</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMenuVisible(false);
                Alert.alert('Profile details', `Showing professional records for ${recipientName}.`);
              }}
              style={styles.modalOption}>
              <MaterialCommunityIcons name="account-details-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.optionText, { color: theme.text }]}>View Credentials Profile</Text>
            </Pressable>

            <Pressable onPress={handleBlockUser} style={[styles.modalOption, { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 }]}>
              <MaterialCommunityIcons name="shield-alert-outline" size={20} color="#FF3B30" />
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>Report & Block Contact</Text>
            </Pressable>

            <Pressable onPress={() => setMenuVisible(false)} style={[styles.modalOption, { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 }]}>
              <Text style={[styles.cancelText, { color: theme.primary }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    ...Shadows.light.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backButton: {
    marginLeft: -Spacing.one,
    padding: 4,
  },
  headerTitleWrap: {
    gap: 1,
  },
  headerName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    padding: 4,
  },
  crisisBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  crisisText: {
    color: '#FF3B30',
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  encryptionNotice: {
    fontSize: FontSize.caption,
    textAlign: 'center',
    marginVertical: Spacing.three,
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: Spacing.three,
  },
  dateDividerText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '85%',
  },
  outgoingRow: {
    alignSelf: 'flex-end',
  },
  incomingRow: {
    alignSelf: 'flex-start',
  },
  normalRowGap: {
    marginTop: Spacing.three,
  },
  consecutiveRowGap: {
    marginTop: 4,
  },
  incomingAvatarWrapper: {
    marginRight: Spacing.two,
  },
  avatarPlaceholder: {
    width: 24, // Matches avatar space width to keep bubbles aligned
    marginRight: Spacing.two,
  },
  bubbleWrapper: {
    gap: 2,
  },
  bubble: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two + 1,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadows.light.card,
  },
  incomingBubble: {
    borderTopLeftRadius: 4,
  },
  outgoingBubble: {
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: FontSize.body - 1,
    lineHeight: 20,
  },
  readReceipt: {
    fontSize: FontSize.caption - 1,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginRight: Spacing.one,
    fontWeight: FontWeight.medium,
  },
  footerInput: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  mediaButton: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.body - 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 0,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 300,
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
