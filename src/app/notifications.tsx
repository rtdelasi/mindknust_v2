import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { BorderRadius, FontSize, FontWeight, MaxContentWidth, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import {
  addDismissedIds,
  addReadIds,
  applyLocalState,
  getUserCreatedAt,
  isBroadcast,
  removeReadId,
} from '@/lib/notification-state';

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  user_id?: string | null;
  is_read?: boolean;
  /** Optional in-app route this notification deep-links to. */
  link?: string | null;
}

/** Horizontal travel past which the row is treated as swiped away. */
const SWIPE_THRESHOLD = 120;
/** Height of a collapsed row's exit animation target. */
const ROW_COLLAPSE_MS = 180;

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const currentUserId =
    auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const unreadCount = useMemo(
    () => announcements.filter((a) => !a.is_read).length,
    [announcements]
  );

  const loadNotifications = useCallback(async () => {
    try {
      if (!supabase) return;

      const userCreatedAt = await getUserCreatedAt(currentUserId);
      let query = supabase
        .from('notifications')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${currentUserId}`);

      if (userCreatedAt) {
        query = query.gte('created_at', userCreatedAt);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        setAnnouncements(await applyLocalState(data as Announcement[], currentUserId, userCreatedAt));
      }
    } catch (err) {
      console.warn('Error loading announcements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  /**
   * Marks a notification read. Personal rows are persisted server-side so the
   * state follows the user across devices; broadcasts are local-only because
   * their `is_read` column is shared by every recipient.
   */
  const markRead = useCallback(
    async (item: Announcement) => {
      if (item.is_read) return;

      setAnnouncements((prev) =>
        prev.map((ann) => (ann.id === item.id ? { ...ann, is_read: true } : ann))
      );

      try {
        await addReadIds(currentUserId, [item.id]);

        if (supabase && !isBroadcast(item)) {
          await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
        }
      } catch (err) {
        console.warn('Error marking notification as read:', err);
      }
    },
    [currentUserId]
  );

  const markUnread = useCallback(
    async (item: Announcement) => {
      setAnnouncements((prev) =>
        prev.map((ann) => (ann.id === item.id ? { ...ann, is_read: false } : ann))
      );

      try {
        await removeReadId(currentUserId, item.id);

        if (supabase && !isBroadcast(item)) {
          await supabase.from('notifications').update({ is_read: false }).eq('id', item.id);
        }
      } catch (err) {
        console.warn('Error marking notification as unread:', err);
      }
    },
    [currentUserId]
  );

  const markAllRead = useCallback(async () => {
    const unread = announcements.filter((a) => !a.is_read);
    if (unread.length === 0) return;

    setAnnouncements((prev) => prev.map((ann) => ({ ...ann, is_read: true })));

    try {
      await addReadIds(
        currentUserId,
        unread.map((a) => a.id)
      );

      const personalIds = unread.filter((a) => !isBroadcast(a)).map((a) => a.id);
      if (supabase && personalIds.length > 0) {
        await supabase.from('notifications').update({ is_read: true }).in('id', personalIds);
      }
    } catch (err) {
      console.warn('Error marking all as read:', err);
    }
  }, [announcements, currentUserId]);

  /**
   * Removes a notification from this user's list. A personal row is deleted
   * outright; a broadcast is only hidden locally, since deleting it would remove
   * the announcement for every other user too.
   */
  const dismiss = useCallback(
    async (item: Announcement) => {
      const previous = announcements;
      setAnnouncements((prev) => prev.filter((ann) => ann.id !== item.id));

      try {
        await addDismissedIds(currentUserId, [item.id]);

        if (supabase && !isBroadcast(item)) {
          const { error } = await supabase.from('notifications').delete().eq('id', item.id);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Error deleting notification:', err);
        // Put the row back rather than leaving the list disagreeing with the server.
        setAnnouncements(previous);
      }
    },
    [announcements, currentUserId]
  );

  const confirmClearAll = useCallback(() => {
    if (announcements.length === 0) return;

    const personalCount = announcements.filter((a) => !isBroadcast(a)).length;
    const broadcastCount = announcements.length - personalCount;

    Alert.alert(
      'Clear all notifications?',
      broadcastCount > 0
        ? `${personalCount} personal notification${personalCount === 1 ? '' : 's'} will be deleted. ` +
          `${broadcastCount} announcement${broadcastCount === 1 ? '' : 's'} will be hidden from your list.`
        : 'This will permanently delete your notifications.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            const previous = announcements;
            setAnnouncements([]);
            try {
              await addDismissedIds(
                currentUserId,
                previous.map((a) => a.id)
              );

              const personalIds = previous.filter((a) => !isBroadcast(a)).map((a) => a.id);
              if (supabase && personalIds.length > 0) {
                const { error } = await supabase
                  .from('notifications')
                  .delete()
                  .in('id', personalIds);
                if (error) throw error;
              }
            } catch (err) {
              console.warn('Error clearing notifications:', err);
              setAnnouncements(previous);
            }
          },
        },
      ]
    );
  }, [announcements, currentUserId]);

  const handleSelectNotification = async (item: Announcement) => {
    await markRead(item);
    if (item.link) {
      router.push(item.link as any);
    } else {
      setSelected(item);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
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
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Announcements</Text>
            {announcements.length > 0 && (
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </Text>
            )}
          </View>
        </View>

        {announcements.length > 0 && (
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Pressable
                onPress={markAllRead}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Mark all as read"
                style={[styles.headerActionBtn, { backgroundColor: theme.primarySoft }]}>
                <MaterialCommunityIcons name="email-open-outline" size={16} color={theme.primary} />
                <Text style={[styles.headerActionText, { color: theme.primary }]}>Read all</Text>
              </Pressable>
            )}
            <Pressable
              onPress={confirmClearAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
              style={[styles.headerActionBtn, { backgroundColor: theme.errorSoft }]}>
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.error} />
            </Pressable>
          </View>
        )}
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
          <SwipeableNotification
            item={item}
            onPress={() => handleSelectNotification(item)}
            onDismiss={() => dismiss(item)}
            onToggleRead={() => (item.is_read ? markUnread(item) : markRead(item))}
            formatTime={formatTime}
          />
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
              <View style={[styles.modalIcon, { backgroundColor: theme.primarySoft }]}>
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

            {selected?.link && (
              <Pressable
                onPress={() => {
                  const link = selected.link;
                  setSelected(null);
                  if (link) router.push(link as any);
                }}
                style={[
                  styles.linkButton,
                  {
                    backgroundColor:
                      selected.title?.includes('Crisis') || selected.title?.includes('Outreach')
                        ? '#EF4444'
                        : theme.primary,
                  },
                ]}>
                <MaterialCommunityIcons
                  name={
                    selected.title?.includes('Crisis') || selected.title?.includes('Outreach')
                      ? 'account-heart-outline'
                      : 'arrow-right-circle'
                  }
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.linkButtonText}>
                  {selected.title?.includes('Crisis') || selected.title?.includes('Outreach')
                    ? 'Contact Student Immediately'
                    : 'Open'}
                </Text>
              </Pressable>
            )}

            <View style={[styles.modalDivider, { backgroundColor: theme.border }]} />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  const item = selected;
                  setSelected(null);
                  if (item) markUnread(item);
                }}
                style={[styles.modalActionBtn, { backgroundColor: theme.surfaceSoft }]}>
                <MaterialCommunityIcons name="email-outline" size={16} color={theme.text} />
                <Text style={[styles.modalActionText, { color: theme.text }]}>Mark unread</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const item = selected;
                  setSelected(null);
                  if (item) dismiss(item);
                }}
                style={[styles.modalActionBtn, { backgroundColor: theme.errorSoft }]}>
                <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.error} />
                <Text style={[styles.modalActionText, { color: theme.error }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * A notification row that can be swiped in either direction to dismiss, with a
 * tap target for toggling read state. Swiping is the discoverable-by-habit
 * gesture; the explicit button and the modal actions keep the same operations
 * reachable for anyone who does not find it.
 */
function SwipeableNotification({
  item,
  onPress,
  onDismiss,
  onToggleRead,
  formatTime,
}: {
  item: Announcement;
  onPress: () => void;
  onDismiss: () => void;
  onToggleRead: () => void;
  formatTime: (iso: string) => string;
}) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  /**
   * -1 until the row has been measured. `withTiming` cannot interpolate from
   * `undefined`, so the collapse only animates once a real pixel height is known;
   * a negative sentinel also lets the style hook return a stable object shape.
   */
  const itemHeight = useSharedValue(-1);
  const opacity = useSharedValue(1);

  const pan = Gesture.Pan()
    // Let the vertical list win until the gesture is clearly horizontal,
    // otherwise every scroll attempt starts dragging a row sideways.
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * 500, { duration: ROW_COLLAPSE_MS });
        opacity.value = withTiming(0, { duration: ROW_COLLAPSE_MS });
        itemHeight.value = withTiming(0, { duration: ROW_COLLAPSE_MS }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      } else {
        translateX.value = withTiming(0, { duration: 140 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const containerStyle = useAnimatedStyle(() =>
    itemHeight.value === undefined ? {} : { height: itemHeight.value, overflow: 'hidden' }
  );

  const deleteHintStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1),
  }));

  return (
    <Animated.View style={containerStyle}>
      <View style={styles.swipeRow}>
        {/* Delete affordance revealed underneath the sliding card */}
        <Animated.View
          style={[styles.swipeBackdrop, { backgroundColor: theme.errorSoft }, deleteHintStyle]}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.error} />
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.error} />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={rowStyle}>
            <Pressable onPress={onPress}>
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

                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={onToggleRead}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={item.is_read ? 'Mark as unread' : 'Mark as read'}
                        style={styles.rowActionBtn}>
                        <MaterialCommunityIcons
                          name={item.is_read ? 'email-outline' : 'email-open-outline'}
                          size={14}
                          color={theme.textSecondary}
                        />
                        <Text style={[styles.rowActionText, { color: theme.textSecondary }]}>
                          {item.is_read ? 'Mark unread' : 'Mark read'}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={onDismiss}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Delete notification"
                        style={styles.rowActionBtn}>
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={14}
                          color={theme.textSecondary}
                        />
                        <Text style={[styles.rowActionText, { color: theme.textSecondary }]}>
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
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
  headerSubtitle: {
    fontSize: FontSize.small,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.oneHalf,
    borderRadius: BorderRadius.full,
  },
  headerActionText: {
    fontSize: FontSize.small,
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
  swipeRow: {
    position: 'relative',
  },
  swipeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.md + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  rowActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: 2,
  },
  rowActionText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
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
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.twoHalf,
    borderRadius: BorderRadius.md,
  },
  modalActionText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.one,
  },
  linkButtonText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
});
