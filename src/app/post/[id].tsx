import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { BorderRadius, FontSize, FontWeight, Spacing, Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import {
  fetchPostDetail,
  fetchComments,
  createComment,
  toggleLikePost,
  incrementShareCount,
  deletePost,
  SupabasePost,
  SupabaseComment
} from '@/lib/supabase-db';
import { getDisplayIdentity, getAuthorInitials, getHandleTag } from '@/lib/display-identity';

export default function PostDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const { userName, role, anonymousId } = useMockAuth();

  const [post, setPost] = useState<SupabasePost | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<SupabaseComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyAsAnonymous, setReplyAsAnonymous] = useState(false);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const loadPostAndComments = async () => {
    if (!postId) return;
    try {
      const detail = await fetchPostDetail(postId, currentUserId);
      setPost(detail);
      const threadComments = await fetchComments(postId);
      setComments(threadComments);
    } catch (err) {
      console.error('Error loading post thread details:', err);
      Alert.alert('Load Error', 'Could not retrieve post details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPostAndComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleToggleLike = async () => {
    if (!post) return;
    const previousState = { ...post };
    try {
      const liked = !post.has_liked;
      setPost({
        ...post,
        has_liked: liked,
        likes_count: post.likes_count + (liked ? 1 : -1)
      });
      await toggleLikePost(post.id, currentUserId);
    } catch (err) {
      console.error('Error toggling like:', err);
      setPost(previousState);
    }
  };

  const handleSharePost = async () => {
    if (!post) return;
    try {
      Clipboard.setString(`https://counselcare.edu/post/${post.id}`);
      Alert.alert('Link Copied', 'Post URL copied to clipboard!');
      setPost({
        ...post,
        shares_count: post.shares_count + 1
      });
      await incrementShareCount(post.id);
    } catch (err) {
      console.error('Error sharing post:', err);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    Alert.alert('Delete Post', 'Are you sure you want to permanently delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post.id);
            router.back();
          } catch (err: any) {
            Alert.alert('Delete Failed', err.message || 'Could not delete post.');
          }
        }
      }
    ]);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !post) return;
    setSubmittingReply(true);
    try {
      const created = await createComment(post.id, currentUserId, replyText.trim(), replyAsAnonymous);
      let finalReply: SupabaseComment;
      if (created) {
        finalReply = created;
      } else {
        finalReply = {
          id: `mock-reply-${Date.now()}`,
          post_id: post.id,
          user_id: currentUserId,
          content: replyText.trim(),
          created_at: new Date().toISOString(),
          is_anonymous: replyAsAnonymous,
          profiles: { name: userName || 'User', role: role || 'student', avatar_url: null }
        };
      }

      // Append reply and increment count on the parent post
      setComments(prev => [...prev, finalReply]);
      setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null);
      setReplyText('');
    } catch (err: any) {
      Alert.alert('Reply Failed', err.message || 'Could not save reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const formatTime = (isoString: string) => {
    const elapsed = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.text }]}>Post not found</Text>
        <Button label="Go Back" variant="primary" onPress={() => router.back()} style={{ marginTop: Spacing.three }} />
      </View>
    );
  }

  const isPostAuthor = post.user_id === currentUserId;
  const authorName = getDisplayIdentity(
    { name: post.profiles?.name, anonymous_id: post.profiles?.anonymous_id },
    post.is_anonymous,
    (role as any) || 'student'
  );
  const authorRole = post.profiles?.role || 'student';
  const isCounselor = authorRole === 'counselor';
  const initials = getAuthorInitials(authorName);
  const handleTag = getHandleTag(authorName);
  const showAnonBadge = post.is_anonymous && !isPostAuthor && !isCounselor;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}>

      {/* Header Bar */}
      <View style={[
        styles.header,
        { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }
      ]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Thread</Text>
        </View>
      </View>

      {/* Main FlatList Thread */}
      <FlatList
        data={comments}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.threadScroll, { paddingBottom: insets.bottom + 80 }]}
        ListHeaderComponent={
          <View style={[styles.originalPostContainer, { borderBottomColor: theme.border }]}>
            <View style={styles.postLayout}>
              <View style={[styles.avatarCircle, { backgroundColor: isCounselor ? theme.primary : '#8A8FD9' }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.authorMetaBlock}>
                <Text style={[styles.authorNameText, { color: theme.text }]}>{authorName}</Text>
                <Text style={[styles.authorHandleText, { color: theme.textSecondary }]}>{handleTag}</Text>
              </View>
              {isCounselor && (
                <View style={[styles.roleBadge, { backgroundColor: `${theme.primary}1D` }]}>
                  <Text style={[styles.roleText, { color: theme.primary }]}>Staff</Text>
                </View>
              )}
              {showAnonBadge && (
                <View style={[styles.roleBadge, { backgroundColor: '#F3E8FF' }]}>
                  <Text style={[styles.roleText, { color: '#7C3AED' }]}>Anonymous</Text>
                </View>
              )}
              {isPostAuthor && (
                <Pressable onPress={handleDeletePost} style={styles.deleteButton}>
                  <MaterialCommunityIcons name="dots-horizontal" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            <Text style={[styles.originalPostContent, { color: theme.text }]}>{post.content}</Text>

            {post.media_url ? (
              <Pressable onPress={() => setPreviewImageUrl(post.media_url || null)}>
                <Image source={{ uri: post.media_url }} style={styles.postImage} resizeMode="cover" />
              </Pressable>
            ) : null}

            <Text style={[styles.postTimestamp, { color: theme.textSecondary }]}>
              {new Date(post.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(post.created_at).toLocaleDateString()}
            </Text>

            {/* Parent Action Row */}
            <View style={[styles.actionBar, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
              <View style={styles.actionItem}>
                <MaterialCommunityIcons name="comment-outline" size={18} color={theme.textSecondary} />
                <Text style={[styles.actionCount, { color: theme.textSecondary }]}>{post.comments_count}</Text>
              </View>

              <Pressable onPress={handleSharePost} style={styles.actionItem}>
                <MaterialCommunityIcons name="share-variant-outline" size={18} color={theme.textSecondary} />
                <Text style={[styles.actionCount, { color: theme.textSecondary }]}>{post.shares_count}</Text>
              </Pressable>

              <Pressable onPress={handleToggleLike} style={styles.actionItem}>
                <MaterialCommunityIcons
                  name={post.has_liked ? "heart" : "heart-outline"}
                  size={18}
                  color={post.has_liked ? "#F91880" : theme.textSecondary}
                />
                <Text style={[styles.actionCount, { color: post.has_liked ? "#F91880" : theme.textSecondary }]}>
                  {post.likes_count}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const comName = getDisplayIdentity(
            { name: item.profiles?.name, anonymous_id: item.profiles?.anonymous_id },
            item.is_anonymous,
            (role as any) || 'student'
          );
          const comInitials = getAuthorInitials(comName);
          const isComCounselor = item.profiles?.role === 'counselor';
          const comHandle = getHandleTag(comName);

          return (
            <View style={[styles.replyItem, { borderBottomColor: theme.border }]}>
              <View style={[styles.replyAvatar, { backgroundColor: isComCounselor ? theme.primary : '#8A8FD9' }]}>
                <Text style={styles.replyAvatarText}>{comInitials}</Text>
              </View>
              <View style={styles.replyContentBlock}>
                <View style={styles.replyHeaderRow}>
                  <Text style={[styles.replyAuthorName, { color: theme.text }]}>{comName}</Text>
                  <Text style={[styles.replyHandle, { color: theme.textSecondary }]}>{comHandle}</Text>
                  <Text style={[styles.replyTime, { color: theme.textSecondary }]}>· {formatTime(item.created_at)}</Text>
                  {item.is_anonymous && (
                    <View style={[styles.anonDot, { backgroundColor: '#7C3AED' }]}>
                      <Text style={styles.anonDotText}>A</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.replyContentText, { color: theme.text }]}>{item.content}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.noRepliesContainer}>
            <Text style={[styles.noRepliesText, { color: theme.textSecondary }]}>Be the first to reply...</Text>
          </View>
        }
      />

      {/* Pinned Reply Composer Dock */}
      <View style={[
        styles.composerDock,
        {
          borderTopColor: theme.border,
          backgroundColor: theme.surfaceRaised,
          paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.two
        }
      ]}>
        <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Post your reply"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.replyInput, { color: theme.text }]}
          />
        </View>
        {role === 'student' && (<Pressable
          onPress={() => setReplyAsAnonymous(!replyAsAnonymous)}
          style={[
            styles.anonReplyToggle,
            replyAsAnonymous && { backgroundColor: `${theme.primary}1D` }
          ]}>
          <MaterialCommunityIcons
            name={replyAsAnonymous ? 'incognito' : 'incognito-off'}
            size={20}
            color={replyAsAnonymous ? theme.primary : theme.textSecondary}
          />
        </Pressable>)}
        <Button
          label={submittingReply ? "..." : "Reply"}
          variant="primary"
          disabled={submittingReply || !replyText.trim()}
          onPress={handleSendReply}
          style={styles.replySendButton}
        />
      </View>

      {/* Full-Screen Image Preview Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.fullscreenImageOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewImageUrl(null)} />
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
          <Pressable style={styles.fullscreenCloseButton} onPress={() => setPreviewImageUrl(null)}>
            <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  emptyText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.two,
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
  threadScroll: {
    paddingVertical: Spacing.one,
  },
  originalPostContainer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  postLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    position: 'relative',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.body - 1,
  },
  authorMetaBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  authorNameText: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  authorHandleText: {
    fontSize: FontSize.caption + 1,
  },
  roleBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: 24,
  },
  roleText: {
    fontSize: FontSize.caption - 2,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 4,
    padding: 6,
  },
  originalPostContent: {
    fontSize: FontSize.body,
    lineHeight: 22,
    marginTop: Spacing.three,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.three,
  },
  postTimestamp: {
    fontSize: FontSize.caption + 1,
    marginTop: Spacing.three,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    marginTop: Spacing.three,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 60,
  },
  actionCount: {
    fontSize: FontSize.caption,
  },
  // Replies styling
  replyItem: {
    flexDirection: 'row',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  replyAvatarText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption - 1,
    fontWeight: FontWeight.bold,
  },
  replyContentBlock: {
    flex: 1,
    gap: 2,
  },
  replyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyAuthorName: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  replyHandle: {
    fontSize: FontSize.caption,
  },
  replyTime: {
    fontSize: FontSize.caption,
  },
  replyContentText: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
  noRepliesContainer: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  noRepliesText: {
    fontSize: FontSize.caption + 1,
    fontStyle: 'italic',
  },
  // Persistent bottom dock
  composerDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  inputWrapper: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  replyInput: {
    fontSize: FontSize.caption + 1,
    paddingVertical: 0,
  },
  replySendButton: {
    height: 38,
    paddingHorizontal: Spacing.three,
  },
  fullscreenImageOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  fullscreenImage: {
    width: '100%',
    height: '85%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100000,
  },
  anonReplyToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonDotText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
