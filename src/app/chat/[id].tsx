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
  Linking,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

import { Avatar } from '@/components/ui/avatar';
import { BorderRadius, FontSize, FontWeight, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { supabase } from '@/lib/supabase';
import {
  fetchMessages,
  sendMessage as submitDbMessage,
  SupabaseMessage,
  markMessagesAsRead,
  markChatNotificationsAsRead,
  fetchOrCreateChat,
} from '@/lib/supabase-db';
import { uploadFileFromUri } from '@/lib/supabase-storage';
import { usePresence } from '@/contexts/presence-context';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  created_at: string;
  delivered_at?: string;
  read_at?: string;
  attachment?: {
    isAttachment: boolean;
    type: 'image' | 'video' | 'audio';
    url: string;
    text?: string;
  };
}

function parseAttachmentMessage(text: string) {
  if (text && text.startsWith('$$ATTACHMENT$$')) {
    try {
      const parsed = JSON.parse(text.substring(14));
      return {
        isAttachment: true,
        type: parsed.type as 'image' | 'video' | 'audio',
        url: parsed.url,
        text: parsed.text || '',
      };
    } catch (e) {
      console.warn('[ChatRoom] Failed to parse attachment JSON:', e);
    }
  }
  return undefined;
}

export default function ChatRoomScreen() {
  const theme = useTheme();
  const isDark = useThemeMode() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    role?: string;
    recipientId?: string;
    studentId?: string;
    studentName?: string;
  }>();
  const { role } = useMockAuth();

  const [activeChatId, setActiveChatId] = useState<string>(params.id !== 'new' ? params.id || '' : '');
  const [resolvedRecipientId, setResolvedRecipientId] = useState<string>(params.recipientId || params.studentId || '');
  const [resolvedRecipientName, setResolvedRecipientName] = useState<string>(
    params.name || (params.studentName ? decodeURIComponent(params.studentName) : 'Student Member')
  );

  const chatId = activeChatId;
  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');
  const recipientName = resolvedRecipientName;
  const recipientRole = params.role || (role === 'counselor' ? 'Student' : 'Counselor');
  const recipientId = resolvedRecipientId;

  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime States
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Modals / Menu visibility states
  const [menuVisible, setMenuVisible] = useState(false);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);

  // Voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef<any>(null);

  // File upload indicator state
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const channelRef = useRef<any>(null);

  const { isUserOnline } = usePresence();
  const otherUserStatus: 'Online' | 'Offline' = isUserOnline(recipientId) ? 'Online' : 'Offline';

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const resolveNewChat = async () => {
      if (params.id === 'new' && (params.studentId || params.recipientId)) {
        const targetSid = params.studentId || params.recipientId || '';
        try {
          const chat = await fetchOrCreateChat(targetSid, currentUserId);
          if (chat) {
            setActiveChatId(chat.id);
            setResolvedRecipientId(targetSid);
            if (params.studentName) {
              setResolvedRecipientName(decodeURIComponent(params.studentName));
            }
          }
        } catch (err) {
          console.warn('Error resolving chat room from notification:', err);
        }
      }
    };
    resolveNewChat();
  }, [params.id, params.studentId, params.recipientId, currentUserId, params.studentName]);

  const loadChatThread = async () => {
    if (!chatId) return;
    try {
      const records = await fetchMessages(chatId);
      const mapped: ChatMessage[] = records.map((m) => {
        const attachment = parseAttachmentMessage(m.text);
        return {
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_id === currentUserId ? 'You' : recipientName,
          text: attachment ? (attachment.text || '') : m.text,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          created_at: m.created_at,
          delivered_at: m.delivered_at,
          read_at: m.read_at,
          attachment,
        };
      });
      setMessages((prev) => {
        const pending = prev.filter(
          (p) =>
            p.id.startsWith('temp-') &&
            !mapped.some((s) => s.senderId === p.senderId && s.text === p.text)
        );
        return [...mapped, ...pending];
      });
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
        await Promise.all([
          markMessagesAsRead(chatId, currentUserId),
          markChatNotificationsAsRead(chatId, currentUserId),
        ]);
      }
    };
    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Realtime Presence / Subscription / Typing Indicators
  useEffect(() => {
    if (!chatId || !supabase) return;

    const channelName = `chat-room-${chatId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
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

          if (insertMsg.sender_id !== currentUserId) {
            markMessagesAsRead(chatId, currentUserId);
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === insertMsg.id)) return prev;

            const attachment = parseAttachmentMessage(insertMsg.text);
            const newMapped: ChatMessage = {
              id: insertMsg.id,
              senderId: insertMsg.sender_id,
              senderName: insertMsg.sender_id === currentUserId ? 'You' : recipientName,
              text: attachment ? (attachment.text || '') : insertMsg.text,
              timestamp: new Date(insertMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              created_at: insertMsg.created_at,
              delivered_at: insertMsg.delivered_at,
              read_at: insertMsg.read_at,
              attachment,
            };

            const pendingIndex = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.senderId === insertMsg.sender_id &&
                m.text === insertMsg.text
            );

            if (pendingIndex > -1) {
              const copy = [...prev];
              copy[pendingIndex] = newMapped;
              return copy;
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
          const updated = payload.new as SupabaseMessage;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updated.id
                ? { ...msg, read_at: updated.read_at, delivered_at: updated.delivered_at }
                : msg
            )
          );
        }
      )
      .on('broadcast', { event: 'typing' }, (response) => {
        const payload = response.payload;
        if (payload.userId !== currentUserId) {
          setOtherUserTyping(payload.typing);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Presence] Successfully subscribed to realtime messages channel.');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn(
            '[Presence] Realtime channel subscription failed. Messages will update only on page focus. ' +
              'If this persists, confirm public.messages is a member of the supabase_realtime publication.'
          );
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Scroll to bottom helper
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
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
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) {
            return prev.filter((m) => m.id !== mockId);
          }
          return prev.map((m) =>
            m.id === mockId
              ? {
                  ...m,
                  id: sent.id,
                  created_at: sent.created_at,
                  delivered_at: sent.delivered_at,
                  read_at: sent.read_at,
                }
              : m
          );
        });
      }
    } catch (err) {
      console.warn('DB message submit failed, using fallback:', err);
    }
  };

  // Draggable Recording Handlers
  const handleStartRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permissions are required to record voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Failed to start recording:', err);
      Alert.alert('Recording Failed', 'Could not access device microphone.');
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await handleSendAttachment('audio', uri);
      }
    } catch (err) {
      console.warn('Failed to stop recording:', err);
    }
  };

  // Media Picker Attachment Handlers
  const handleSendAttachment = async (type: 'image' | 'video' | 'audio', localUri: string) => {
    if (!chatId) return;
    setUploadingAttachment(true);
    try {
      let extension = 'jpg';
      let contentType = 'image/jpeg';
      
      if (type === 'audio') {
        extension = 'm4a';
        contentType = 'audio/x-m4a';
      } else if (type === 'video') {
        extension = 'mp4';
        contentType = 'video/mp4';
      }

      const filename = `${Date.now()}.${extension}`;
      const path = `chat/${chatId}/${filename}`;

      // Upload payload asynchronously to public Supabase bucket
      const publicUrl = await uploadFileFromUri('post-attachments', path, localUri, contentType);

      const mockId = `temp-${Date.now()}`;
      const attachmentData = {
        isAttachment: true,
        type,
        url: publicUrl,
        text: type === 'audio' ? '🎙️ Voice Note' : type === 'video' ? '🎥 Video Attachment' : '📷 Image Attachment',
      };
      
      const bodyText = `$$ATTACHMENT$$${JSON.stringify(attachmentData)}`;

      const optimisticMessage: ChatMessage = {
        id: mockId,
        senderId: currentUserId,
        senderName: 'You',
        text: attachmentData.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        created_at: new Date().toISOString(),
        delivered_at: undefined,
        read_at: undefined,
        attachment: {
          isAttachment: true,
          type,
          url: publicUrl,
          text: attachmentData.text,
        },
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      const sent = await submitDbMessage(chatId, currentUserId, bodyText);
      if (sent) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) {
            return prev.filter((m) => m.id !== mockId);
          }
          return prev.map((m) =>
            m.id === mockId
              ? {
                  ...m,
                  id: sent.id,
                  created_at: sent.created_at,
                  delivered_at: sent.delivered_at,
                  read_at: sent.read_at,
                }
              : m
          );
        });
      }
    } catch (err) {
      console.warn('Failed to upload and send attachment:', err);
      Alert.alert('Upload Failed', 'Could not send attachment. Please verify network connectivity.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handlePickImage = async () => {
    setAttachmentMenuVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library access is required to attach photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await handleSendAttachment('image', uri);
      }
    } catch (err) {
      console.warn('Pick image failed:', err);
    }
  };

  const handlePickVideo = async () => {
    setAttachmentMenuVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library access is required to attach videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await handleSendAttachment('video', uri);
      }
    } catch (err) {
      console.warn('Pick video failed:', err);
    }
  };

  const handleTakePhoto = async () => {
    setAttachmentMenuVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        await handleSendAttachment('image', uri);
      }
    } catch (err) {
      console.warn('Take photo failed:', err);
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      
      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }, isDark ? Shadows.dark.card : Shadows.light.card]}>
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
            onPress={() => router.push({ pathname: '/video-call', params: { counselorName: recipientName, counselorId: recipientId, callType: 'video', isIncomingAccepted: 'false' } })}>
            <MaterialCommunityIcons name="video" size={20} color={theme.primary} />
          </Pressable>
          <Pressable style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Safety / Crisis Banner */}
      {role === 'student' && (
        <Pressable
          onPress={handleCrisisHotline}
          style={[styles.crisisBanner, { backgroundColor: theme.errorSoft, borderColor: theme.error }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.error} />
          <Text style={[styles.crisisText, { color: theme.error }]}>Need urgent help? Tap for Crisis Support</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={theme.error} />
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
          style={styles.messageList}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          <Text style={[styles.encryptionNotice, { color: theme.textSecondary }]}>
            🔒 End-to-end encrypted consultations. Your privacy is protected.
          </Text>

          {messages.map((msg, index) => {
            const isOutgoing = msg.senderId === currentUserId;
            const previousMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive = previousMsg && previousMsg.senderId === msg.senderId;

            const showDateDivider =
              !previousMsg ||
              new Date(msg.created_at).getTime() - new Date(previousMsg.created_at).getTime() > 1800000;

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
                        isDark ? Shadows.dark.card : Shadows.light.card,
                        msg.attachment && { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }
                      ]}>
                      {msg.attachment ? (
                        <View style={{ width: 220 }}>
                          {msg.attachment.type === 'image' && (
                            <ImageAttachmentView url={msg.attachment.url} />
                          )}
                          {msg.attachment.type === 'video' && (
                            <VideoAttachmentView url={msg.attachment.url} />
                          )}
                          {msg.attachment.type === 'audio' && (
                            <AudioAttachmentView url={msg.attachment.url} isOutgoing={isOutgoing} />
                          )}
                        </View>
                      ) : (
                        <Text style={[styles.messageText, { color: isOutgoing ? theme.onPrimary : theme.text }]}>
                          {msg.text}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

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
              <View style={[styles.bubble, styles.incomingBubble, { backgroundColor: theme.surfaceSoft, borderColor: theme.border, paddingVertical: 8 }, isDark ? Shadows.dark.card : Shadows.light.card]}>
                <Text style={{ fontStyle: 'italic', fontSize: FontSize.caption, color: theme.textSecondary }}>
                  {recipientName} is typing...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Uploading Status Overlay */}
      {uploadingAttachment && (
        <View style={[styles.uploadBar, { backgroundColor: theme.surfaceSoft, borderTopWidth: 1, borderTopColor: theme.border }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 'medium' }}>
            Uploading media attachment...
          </Text>
        </View>
      )}

      {/* Input controls footer */}
      <View style={[styles.footerInput, { paddingBottom: Math.max(insets.bottom, Spacing.three), borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
        <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
          
          <Pressable
            style={styles.mediaButton}
            onPress={() => setAttachmentMenuVisible(true)}>
            <MaterialCommunityIcons name="paperclip" size={22} color={theme.textSecondary} />
          </Pressable>

          {isRecording ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
              <View style={[styles.recordingDot, { backgroundColor: theme.error }]} />
              <Text style={{ fontSize: FontSize.body - 1, color: theme.error, fontWeight: 'bold' }}>
                Recording voice note ({recordingDuration}s)...
              </Text>
            </View>
          ) : (
            <TextInput
              placeholder="Type your message..."
              placeholderTextColor={theme.textSecondary}
              value={text}
              onChangeText={handleTextChange}
              style={[styles.textInput, { color: theme.text }]}
            />
          )}

          {text.trim().length > 0 ? (
            <Pressable
              onPress={handleSendMessage}
              style={[styles.sendButton, { backgroundColor: theme.primary }]}>
              <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              style={[styles.sendButton, { backgroundColor: isRecording ? theme.error : theme.primary }]}>
              <MaterialCommunityIcons name={isRecording ? "stop" : "microphone"} size={18} color="#FFFFFF" />
            </Pressable>
          )}

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
              <MaterialCommunityIcons name="shield-alert-outline" size={20} color={theme.error} />
              <Text style={[styles.optionText, { color: theme.error }]}>Report & Block Contact</Text>
            </Pressable>

            <Pressable onPress={() => setMenuVisible(false)} style={[styles.modalOption, { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 }]}>
              <Text style={[styles.cancelText, { color: theme.primary }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Attachment Selection Menu Modal */}
      <Modal visible={attachmentMenuVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setAttachmentMenuVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.surfaceRaised }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Attach Media</Text>
            
            <Pressable onPress={handleTakePhoto} style={styles.modalOption}>
              <MaterialCommunityIcons name="camera" size={20} color={theme.textSecondary} />
              <Text style={[styles.optionText, { color: theme.text }]}>Take Photo</Text>
            </Pressable>

            <Pressable onPress={handlePickImage} style={styles.modalOption}>
              <MaterialCommunityIcons name="image" size={20} color={theme.textSecondary} />
              <Text style={[styles.optionText, { color: theme.text }]}>Choose Photo from Gallery</Text>
            </Pressable>

            <Pressable onPress={handlePickVideo} style={styles.modalOption}>
              <MaterialCommunityIcons name="video-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.optionText, { color: theme.text }]}>Choose Video from Gallery</Text>
            </Pressable>

            <Pressable onPress={() => setAttachmentMenuVisible(false)} style={[styles.modalOption, { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 }]}>
              <Text style={[styles.cancelText, { color: theme.primary }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  );
}

/* ────────────────────────────────────────────────────────
   Attachment Render Views
   ──────────────────────────────────────────────────────── */

function ImageAttachmentView({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  return (
    <Pressable onPress={() => Linking.openURL(url)}>
      <Image
        source={{ uri: url }}
        style={{ width: '100%', height: 160 }}
        resizeMode="cover"
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)' }]}>
          <ActivityIndicator size="small" />
        </View>
      )}
    </Pressable>
  );
}

function VideoAttachmentView({ url }: { url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={{ width: '100%', height: 140, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
      <MaterialCommunityIcons name="play-circle" size={48} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 4, fontWeight: 'bold' }}>Play Video</Text>
    </Pressable>
  );
}

function AudioAttachmentView({ url, isOutgoing }: { url: string; isOutgoing: boolean }) {
  const theme = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handlePlayPause = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPosition(status.positionMillis);
              setDuration(status.durationMillis || 0);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('Playback error:', err);
    }
  };

  const formatTime = (millis: number) => {
    if (isNaN(millis) || millis < 0) return '0:00';
    const seconds = Math.floor((millis / 1000) % 60);
    const minutes = Math.floor(millis / 60000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const textColor = isOutgoing ? theme.onPrimary : theme.text;
  const accentColor = isOutgoing ? '#FFFFFF' : theme.primary;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.two + 2, gap: Spacing.two, minWidth: 200 }}>
      <Pressable
        onPress={handlePlayPause}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isOutgoing ? 'rgba(255,255,255,0.2)' : theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color={accentColor}
        />
      </Pressable>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 12, color: textColor, fontWeight: 'bold' }}>
          🎙️ Voice Note
        </Text>
        <Text style={{ fontSize: 10, color: isOutgoing ? 'rgba(255,255,255,0.7)' : theme.textSecondary }}>
          {formatTime(position)} / {duration > 0 ? formatTime(duration) : '0:00'}
        </Text>
      </View>
    </View>
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
    width: 24,
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
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: Spacing.two,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
