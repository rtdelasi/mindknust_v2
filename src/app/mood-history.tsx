import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { fetchMoodLogs } from '@/lib/supabase-db';
import { safeStorage } from '@/lib/safe-storage';

interface MoodLog {
  id: string;
  mood: string;
  note: string;
  date: string;
  time: string;
}

export default function MoodHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = auth?.currentUser?.uid || 'student-user';

  const fetchLogs = async () => {
    try {
      const dbLogs = await fetchMoodLogs(currentUserId);
      if (dbLogs && dbLogs.length > 0) {
        const formatted: MoodLog[] = dbLogs.map((l) => ({
          id: l.id,
          mood: l.mood,
          note: l.note || '',
          date: new Date(l.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          time: new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setLogs(formatted);
      } else {
        const existing = await safeStorage.getItem('counselcare_mood_logs');
        if (existing) {
          setLogs(JSON.parse(existing));
        }
      }
    } catch (e) {
      console.warn('DB mood logs fetch failed, loading local logs:', e);
      const existing = await safeStorage.getItem('counselcare_mood_logs');
      if (existing) {
        setLogs(JSON.parse(existing));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteEntry = async (id: string) => {
    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this mood journal entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Note: We delete locally for now. If table delete is needed, it can be extended.
              const updated = logs.filter((log) => log.id !== id);
              setLogs(updated);
              await safeStorage.setItem('counselcare_mood_logs', JSON.stringify(updated));
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to delete log.');
            }
          },
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Logs',
      'Are you sure you want to delete all mood history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setLogs([]);
              await safeStorage.removeItem('counselcare_mood_logs');
            } catch (e) {
              console.error(e);
            }
          },
        },
      ]
    );
  };

  const getMoodLabel = (emoji: string) => {
    const map: Record<string, string> = {
      '😢': 'Sad',
      '😕': 'Meh',
      '🙂': 'Okay',
      '😊': 'Good',
      '😁': 'Great',
    };
    return map[emoji] || 'Logged';
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mood Journal History</Text>
        </View>

        {logs.length > 0 ? (
          <Pressable onPress={handleClearAll} style={styles.clearButton}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#EF4444" />
          </Pressable>
        ) : null}
      </View>

      {/* Entry Feed */}
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + Spacing.four }]}
        ListHeaderComponent={
          logs.length > 0 ? (
            <View style={styles.summaryContainer}>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                You have logged {logs.length} journal {logs.length === 1 ? 'entry' : 'entries'}. Keep updating your log daily!
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceSoft }]}>
                <MaterialCommunityIcons name="notebook-edit-outline" size={48} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No entries logged yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Head to your home dashboard to write down your first daily reflection.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card variant="surface" padding="four" style={styles.logCard}>
            <View style={styles.logCardHeader}>
              <View style={styles.logCardLeft}>
                <View style={[styles.moodBubble, { backgroundColor: theme.surfaceSoft }]}>
                  <Text style={styles.moodEmoji}>{item.mood}</Text>
                </View>
                <View style={styles.logMeta}>
                  <Text style={[styles.moodLabel, { color: theme.text }]}>
                    Feeling {getMoodLabel(item.mood)}
                  </Text>
                  <Text style={[styles.logTime, { color: theme.textSecondary }]}>
                    {item.date} • {item.time}
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => handleDeleteEntry(item.id)} style={styles.deleteButton}>
                <MaterialCommunityIcons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            {item.note ? (
              <View style={[styles.noteWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.noteText, { color: theme.text }]}>{item.note}</Text>
              </View>
            ) : (
              <Text style={[styles.noNoteText, { color: theme.textSecondary }]}>
                No details written
              </Text>
            )}
          </Card>
        )}
      />
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
    gap: Spacing.one,
  },
  backButton: {
    marginLeft: -Spacing.one,
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  clearButton: {
    padding: 6,
  },
  listContainer: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  summaryContainer: {
    paddingBottom: Spacing.one,
  },
  summaryText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
    gap: Spacing.two,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  emptySubtitle: {
    fontSize: FontSize.caption + 1,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  logCard: {
    gap: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  moodBubble: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 24,
  },
  logMeta: {
    gap: 2,
  },
  moodLabel: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  logTime: {
    fontSize: FontSize.small,
  },
  deleteButton: {
    padding: 6,
  },
  noteWrapper: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  noteText: {
    fontSize: FontSize.body - 2,
    lineHeight: 18,
  },
  noNoteText: {
    fontSize: FontSize.small + 1,
    fontStyle: 'italic',
  },
});
