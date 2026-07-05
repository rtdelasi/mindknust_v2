import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, FontSize, FontWeight, Shadows, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AIMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export default function AIChatbotScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hi there! I'm MindBuddy, your virtual wellbeing guide. How are you feeling today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [messages, isTyping]);

  const getAIResponse = (userQuery: string): string => {
    const query = userQuery.toLowerCase();
    if (query.includes('anxiety') || query.includes('anxious') || query.includes('stress') || query.includes('exam')) {
      return "I hear you. Academic pressure can feel overwhelming. Try this quick grounding exercise: inhale slowly for 4 seconds, hold for 4, and exhale for 4. Amina Owusu, our student counselor, also has bookings open today to map out a stress routine!";
    }
    if (query.includes('sleep') || query.includes('sleepy') || query.includes('tired') || query.includes('insomnia')) {
      return "Getting restful sleep is key! Try setting a screen-free window 30 minutes before bed. You can review time management tips with Nana Serwaa or Kwame Boateng's coaches slots on our Search page.";
    }
    if (query.includes('counselor') || query.includes('book') || query.includes('appointment')) {
      return "You can explore all our licensed campus counselors on the Search tab! Kwame, Amina, and Nana specialize in anxiety, personal growth, and relationships. They are available for both online and hybrid check-ins.";
    }
    return "I'm always here to listen and help you process what's on your mind. Tell me a bit more about how you're feeling, or ask me for a quick breathing routine!";
  };

  const handleSend = (inputText: string) => {
    if (!inputText.trim()) return;

    const userMsg: AIMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setText('');
    setIsTyping(true);

    // Simulate AI thinking delay
    setTimeout(() => {
      const aiReplyText = getAIResponse(inputText);
      const aiMsg: AIMessage = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const suggestions = [
    { label: "I'm feeling stressed", query: "I'm feeling really stressed about exams" },
    { label: "Help me sleep", query: "I can't sleep well recently" },
    { label: "Book a counselor", query: "How do I book a counselor?" },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <View style={[styles.botAvatar, { backgroundColor: theme.primarySoft }]}>
            <MaterialCommunityIcons name="robot" size={22} color={theme.primary} />
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerName, { color: theme.text }]}>MindBuddy</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>Wellbeing Guide • Active</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.callButton, { backgroundColor: theme.primarySoft }]}
          onPress={() => router.back()}>
          <MaterialCommunityIcons name="home-outline" size={20} color={theme.primary} />
        </Pressable>
      </View>

      {/* Messages Stream */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.messagesContainer, { paddingBottom: Spacing.four }]}
        style={styles.messageList}>
        
        <View style={styles.introBlock}>
          <View style={[styles.largeBotIcon, { backgroundColor: theme.primarySoft }]}>
            <MaterialCommunityIcons name="robot-outline" size={48} color={theme.primary} />
          </View>
          <Text style={[styles.introTitle, { color: theme.text }]}>Meet MindBuddy</Text>
          <Text style={[styles.introSubtitle, { color: theme.textSecondary }]}>
            Your virtual wellbeing companion. I can suggest clinical techniques, sleeping tips, or guide you to book actual counselor slots.
          </Text>
        </View>

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                isUser ? styles.outgoingRow : styles.incomingRow,
              ]}>
              {!isUser ? (
                <View style={styles.incomingAvatarWrapper}>
                  <View style={[styles.miniBotAvatar, { backgroundColor: theme.primarySoft }]}>
                    <MaterialCommunityIcons name="robot" size={14} color={theme.primary} />
                  </View>
                </View>
              ) : null}

              <View style={styles.bubbleWrapper}>
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? [styles.outgoingBubble, { backgroundColor: theme.primary }]
                      : [styles.incomingBubble, { backgroundColor: theme.surfaceSoft }],
                  ]}>
                  <Text style={[styles.messageText, { color: isUser ? theme.onPrimary : theme.text }]}>
                    {msg.text}
                  </Text>
                </View>
                <Text style={[styles.msgTime, { color: theme.textSecondary }]}>{msg.timestamp}</Text>
              </View>
            </View>
          );
        })}

        {/* Typing indicator */}
        {isTyping ? (
          <View style={[styles.messageRow, styles.incomingRow]}>
            <View style={styles.incomingAvatarWrapper}>
              <View style={[styles.miniBotAvatar, { backgroundColor: theme.primarySoft }]}>
                <MaterialCommunityIcons name="robot" size={14} color={theme.primary} />
              </View>
            </View>
            <View style={[styles.bubble, styles.incomingBubble, { backgroundColor: theme.surfaceSoft }]}>
              <Text style={{ color: theme.textSecondary, fontStyle: 'italic', fontSize: FontSize.body - 2 }}>
                MindBuddy is typing...
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Suggestion Pills */}
      <View style={styles.suggestionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
          {suggestions.map((sug) => (
            <Pressable
              key={sug.label}
              onPress={() => handleSend(sug.query)}
              style={[styles.suggestionPill, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <Text style={[styles.suggestionText, { color: theme.primary }]}>{sug.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Bottom Text Inputs */}
      <View style={[styles.footerInput, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
        <View style={[styles.inputContainer, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <TextInput
            placeholder="Talk to MindBuddy..."
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => handleSend(text)}
            style={[styles.textInput, { color: theme.text }]}
          />
          <Pressable
            onPress={() => handleSend(text)}
            style={[
              styles.sendButton,
              { backgroundColor: text.trim() ? theme.primary : theme.surfaceMuted },
            ]}>
            <MaterialCommunityIcons
              name="send"
              size={18}
              color={text.trim() ? theme.onPrimary : theme.textSecondary}
            />
          </Pressable>
        </View>
      </View>
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
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FontSize.small,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    flex: 1,
  },
  messagesContainer: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  introBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  largeBotIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.light.card,
  },
  introTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  introSubtitle: {
    fontSize: FontSize.caption + 1,
    lineHeight: 20,
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    maxWidth: '85%',
  },
  outgoingRow: {
    alignSelf: 'flex-end',
  },
  incomingRow: {
    alignSelf: 'flex-start',
  },
  incomingAvatarWrapper: {
    marginBottom: 4,
  },
  miniBotAvatar: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleWrapper: {
    gap: 2,
  },
  bubble: {
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.md,
  },
  outgoingBubble: {
    borderBottomRightRadius: 2,
  },
  incomingBubble: {
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: FontSize.body - 1,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: FontSize.small - 1,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  suggestionsContainer: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  suggestionsRow: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  suggestionPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    ...Shadows.light.card,
  },
  suggestionText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  footerInput: {
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    ...Shadows.light.card,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.body - 1,
    paddingVertical: 0,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
