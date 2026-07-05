import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAnnouncements(data);
      }
    } catch (err) {
      console.warn('Error loading announcements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const formatTime = (isoString: string) => {
    const elapsed = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }
      ]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Announcements</Text>
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadNotifications();
        }}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + Spacing.four }]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>All Quiet Here</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                No app-wide announcements broadcasted yet. Check back later!
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card variant="raised" padding="three" style={styles.notifCard}>
            <View style={styles.notifLayout}>
              <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
                <MaterialCommunityIcons name="bullhorn-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.contentBox}>
                <View style={styles.notifHeader}>
                  <Text style={[styles.notifTitleText, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.notifTimeText, { color: theme.textSecondary }]}>{formatTime(item.created_at)}</Text>
                </View>
                <Text style={[styles.notifBodyText, { color: theme.textSecondary }]}>{item.body}</Text>
              </View>
            </View>
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
  listContainer: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  loadingContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  emptySubtitle: {
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    paddingHorizontal: Spacing.five,
    lineHeight: 18,
  },
  notifCard: {
    borderRadius: BorderRadius.md + 4,
  },
  notifLayout: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBox: {
    flex: 1,
    gap: 4,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitleText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  notifTimeText: {
    fontSize: FontSize.caption,
  },
  notifBodyText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
});
