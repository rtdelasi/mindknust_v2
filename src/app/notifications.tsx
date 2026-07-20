import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { BorderRadius, FontSize, FontWeight, MaxContentWidth, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  user_id?: string | null;
  is_read?: boolean;
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const loadNotifications = async () => {
    try {
      if (!supabase) return;
      const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const localReadJson = await AsyncStorage.getItem('counselcare_read_notification_ids');
        const localReadIds: string[] = localReadJson ? JSON.parse(localReadJson) : [];

        const merged = data.map((item: any) => ({
          ...item,
          is_read: item.is_read || localReadIds.includes(item.id),
        }));

        setAnnouncements(merged);
      }
    } catch (err) {
      console.warn('Error loading announcements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSelectNotification = async (item: Announcement) => {
    setSelected(item);

    if (!item.is_read) {
      setAnnouncements((prev) =>
        prev.map((ann) => (ann.id === item.id ? { ...ann, is_read: true } : ann))
      );

      try {
        const localReadJson = await AsyncStorage.getItem('counselcare_read_notification_ids');
        const localReadIds: string[] = localReadJson ? JSON.parse(localReadJson) : [];
        if (!localReadIds.includes(item.id)) {
          localReadIds.push(item.id);
          await AsyncStorage.setItem('counselcare_read_notification_ids', JSON.stringify(localReadIds));
        }

        if (supabase) {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', item.id);
        }
      } catch (err) {
        console.warn('Error marking notification as read:', err);
      }
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

  const formatFullDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
          <Pressable onPress={() => handleSelectNotification(item)}>
            <Card
              variant="raised"
              padding="three"
              style={[
                styles.notifCard,
                !item.is_read && {
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.primary,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.notifLayout}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: !item.is_read ? theme.surfaceRaised : theme.primarySoft },
                  ]}
                >
                  <MaterialCommunityIcons name="bullhorn-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.contentBox}>
                  <View style={styles.notifHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {!item.is_read && (
                        <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                      )}
                      <Text style={[styles.notifTitleText, { color: theme.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={[styles.notifTimeText, { color: theme.textSecondary }]}>{formatTime(item.created_at)}</Text>
                  </View>
                  <Text
                    style={[styles.notifBodyText, { color: theme.textSecondary }]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.body}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />

      {/* Detail Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={selected !== null}
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.surfaceRaised, borderTopColor: theme.border },
            ]}
          >
            <View style={styles.modalDragIndicator} />

            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <MaterialCommunityIcons
                  name="bullhorn-outline"
                  size={22}
                  color={theme.primary}
                />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {selected?.title}
                </Text>
                <Text style={[styles.modalTimestamp, { color: theme.textSecondary }]}>
                  {selected ? formatFullDate(selected.created_at) : ''}
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseButton, { backgroundColor: theme.surfaceSoft }]}
                onPress={() => setSelected(null)}
              >
                <MaterialCommunityIcons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: theme.border }]} />

            <Text style={[styles.modalBody, { color: theme.text }]}>
              {selected?.body}
            </Text>
          </View>
        </Pressable>
      </Modal>
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

  /* ── Detail Modal ── */
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.four,
    maxHeight: '80%',
    borderTopWidth: 1,
    gap: Spacing.three,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  modalTimestamp: {
    fontSize: FontSize.small,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDivider: {
    height: 1,
  },
  modalBody: {
    fontSize: FontSize.body,
    lineHeight: 24,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
});
