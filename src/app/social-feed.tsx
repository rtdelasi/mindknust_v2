import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { BorderRadius, FontSize, FontWeight, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { moderateContent, keywordModerate, isHFConfigured } from '@/lib/sentiment';
import { hasSupabaseConfig } from '@/lib/supabase';
import {
  createPost,
  deletePost,
  fetchPosts,
  incrementShareCount,
  SupabasePost,
  toggleLikePost,
  updatePostModeration
} from '@/lib/supabase-db';
import { uploadFileFromUri } from '@/lib/supabase-storage';
import { getDisplayIdentity, getAuthorInitials, getHandleTag } from '@/lib/display-identity';

const AVATAR_GRADIENTS = [
  ['#8B7CFF', '#5B4FE5'], // Purple Indigo
  ['#6C63FF', '#3B2FAD'], // Deep Indigo
  ['#E879A0', '#8B7CFF'], // Pink Purple
  ['#14B8A6', '#5B4FE5'], // Teal Blue
  ['#FF6B6B', '#F59E0B'], // Coral Orange
];

const getAvatarGradient = (userId: string): [string, string] => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index] as [string, string];
};

function PostCardImage({ uri, onPreview }: { uri: string; onPreview: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const theme = useTheme();

  if (error) {
    return (
      <View style={[styles.imageErrorContainer, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
        <MaterialCommunityIcons name="image-broken-variant" size={24} color={theme.textSecondary} />
        <Text style={[styles.imageErrorText, { color: theme.textSecondary }]}>Image could not be loaded</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onPreview} style={styles.postImageContainer}>
      <Image
        source={{ uri }}
        style={styles.postImage}
        resizeMode="cover"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setError(true)}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.surfaceSoft, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      )}
    </Pressable>
  );
}

function LikeButton({ hasLiked, count, onPress }: { hasLiked: boolean; count: number; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={styles.actionItem}
    >
      <MaterialCommunityIcons
        name={hasLiked ? "heart" : "heart-outline"}
        size={20}
        color={hasLiked ? theme.rose : theme.textSecondary}
      />
      <Text style={[styles.actionCount, { color: hasLiked ? theme.rose : theme.textSecondary }]}>
        {count}
      </Text>
    </Pressable>
  );
}

function ActionButton({ icon, count, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; count: number; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={styles.actionItem}
    >
      <MaterialCommunityIcons name={icon} size={20} color={theme.textSecondary} />
      {count > 0 && (
        <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

function SkeletonCard() {
  const theme = useTheme();

  return (
    <View style={[styles.postCard, { borderBottomWidth: 1, borderBottomColor: theme.divider, opacity: 0.5 }]}>
      <View style={styles.postLayout}>
        <View style={styles.leftColumn}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.surfaceSoft }]} />
        </View>
        <View style={styles.rightColumn}>
          <View style={styles.authorMetaRow}>
            <View style={[styles.skeletonLine, { width: 100, height: 16, backgroundColor: theme.surfaceSoft }]} />
            <View style={[styles.skeletonLine, { width: 60, height: 12, backgroundColor: theme.surfaceSoft }]} />
          </View>
          <View style={[styles.skeletonLine, { width: '95%', height: 14, marginTop: 8, backgroundColor: theme.surfaceSoft }]} />
          <View style={[styles.skeletonLine, { width: '80%', height: 14, marginTop: 6, backgroundColor: theme.surfaceSoft }]} />
          <View style={[styles.skeletonLine, { width: '50%', height: 14, marginTop: 6, backgroundColor: theme.surfaceSoft }]} />
        </View>
      </View>
    </View>
  );
}

export default function SocialFeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, role, anonymousId } = useMockAuth();

  const [posts, setPosts] = useState<SupabasePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMediaUri, setSelectedMediaUri] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [postAsAnonymous, setPostAsAnonymous] = useState(false);

  // Compose Modal & Figma Views State Machine
  const [composeModalVisible, setComposeModalVisible] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'compose' | 'camera'>('compose');
  const [cameraMode, setCameraMode] = useState<'video' | 'capture'>('capture');
  const [cameraFlashActive, setCameraFlashActive] = useState(false);
  const [flashTriggered, setFlashTriggered] = useState(false);

  // Hardware integration hooks
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const loadFeed = async () => {
    try {
      const feedPosts = await fetchPosts(currentUserId);
      setPosts(feedPosts);
    } catch (err) {
      console.error('Error fetching feed posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload feed on screen focus to sync metrics
  useFocusEffect(
    useCallback(() => {
      loadFeed();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !selectedMediaUri) return;

    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      if (selectedMediaUri) {
        if (hasSupabaseConfig && !selectedMediaUri.startsWith('http')) {
          try {
            const filename = `feed/${currentUserId}/${Date.now()}.jpg`;
            mediaUrl = await uploadFileFromUri('social-media', filename, selectedMediaUri, 'image/jpeg');
          } catch (uploadErr) {
            console.warn('Storage upload failed, using local URI fallback:', uploadErr);
            mediaUrl = selectedMediaUri;
          }
        } else {
          mediaUrl = selectedMediaUri;
        }
      }

      // 1. Run local keyword moderation first (instant fallback)
      const localMod = keywordModerate(newPostContent.trim());

      if (localMod.status === 'blocked') {
        Alert.alert(
          'Post Blocked',
          'Your post contains language that violates KNUST community guidelines and has been blocked.'
        );
        setSubmitting(false);
        return;
      }

      if (localMod.status === 'flagged') {
        Alert.alert(
          'Support is Available',
          'Your post contains words associated with self-harm. Please remember that KNUST Counseling services are available 24/7 at 03220-60352.'
        );
      }

      // 2. Create the post immediately using the fast local moderation result
      const created = await createPost(currentUserId, newPostContent.trim(), mediaUrl, localMod, postAsAnonymous);
      if (created) {
        await loadFeed();
        setNewPostContent('');
        setSelectedMediaUri(null);
        setComposeModalVisible(false);
        setSubmitting(false); // Clear submitting state early so user doesn't wait for background check

        // 3. Trigger Hugging Face API check in the background
        if (isHFConfigured()) {
          moderateContent(created.content).then(async (hfMod) => {
            if (hfMod.source === 'huggingface' && hfMod.status !== localMod.status) {
              console.log(`[Background Moderation] Post ${created.id} status changed: ${localMod.status} -> ${hfMod.status}`);
              await updatePostModeration(created.id, hfMod.status, hfMod.isFlagged, hfMod.reason);
              // Refresh the feed if the post has been blocked or flagged
              loadFeed();
            }
          }).catch((err) => {
            console.warn('[Background Moderation] Error running HF model:', err);
          });
        }
      } else {
        // Fallback for mock sandbox testing
        const newMockPost: SupabasePost = {
          id: `mock-post-${Date.now()}`,
          user_id: currentUserId,
          content: newPostContent.trim(),
          media_url: mediaUrl,
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          created_at: new Date().toISOString(),
          is_anonymous: postAsAnonymous,
          profiles: {
            name: userName || 'User',
            role: role || 'student',
            avatar_url: null,
            anonymous_id: anonymousId || undefined,
          },
          has_liked: false,
          moderation_status: localMod.status,
          is_flagged: localMod.isFlagged,
          flag_reason: localMod.reason || undefined
        };
        setPosts(prev => [newMockPost, ...prev]);
        setNewPostContent('');
        setSelectedMediaUri(null);
        setComposeModalVisible(false);
        setSubmitting(false);

        // Run background moderation in sandbox mock mode as well
        if (isHFConfigured()) {
          moderateContent(newMockPost.content).then((hfMod) => {
            if (hfMod.source === 'huggingface' && hfMod.status === 'blocked') {
              // Remove blocked post from sandbox feed
              setPosts(prev => prev.filter(p => p.id !== newMockPost.id));
              Alert.alert('Post Blocked (ML Moderation)', 'Your mock post was removed in the background by the Hugging Face moderation model.');
            } else if (hfMod.source === 'huggingface' && hfMod.status === 'flagged') {
              setPosts(prev => prev.map(p => p.id === newMockPost.id ? { ...p, moderation_status: 'flagged', is_flagged: true } : p));
            }
          }).catch((err) => {
            console.warn('[Background Moderation Mock] Error:', err);
          });
        }
      }
    } catch (err: any) {
      Alert.alert('Post Failed', err.message || 'Could not save post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to permanently delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
          } catch (err: any) {
            Alert.alert('Delete Failed', err.message || 'Could not delete post.');
          }
        }
      }
    ]);
  };

  const handleToggleLike = async (postId: string) => {
    try {
      setPosts(prev =>
        prev.map(post => {
          if (post.id === postId) {
            const liked = !post.has_liked;
            return {
              ...post,
              has_liked: liked,
              likes_count: post.likes_count + (liked ? 1 : -1)
            };
          }
          return post;
        })
      );
      await toggleLikePost(postId, currentUserId);
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleSharePost = async (postId: string) => {
    try {
      Clipboard.setString(`https://counselcare.edu/post/${postId}`);
      Alert.alert('Link Copied', 'Post URL copied to clipboard!');
      setPosts(prev =>
        prev.map(post => {
          if (post.id === postId) {
            return { ...post, shares_count: post.shares_count + 1 };
          }
          return post;
        })
      );
      await incrementShareCount(postId);
    } catch (err) {
      console.error('Error sharing post:', err);
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

  // Live Camera Photo Capture Trigger
  const handleCameraCapture = async () => {
    if (cameraRef.current) {
      try {
        setFlashTriggered(true);
        const options = { quality: 0.8, skipProcessing: false };
        const photo = await cameraRef.current.takePictureAsync(options);
        setFlashTriggered(false);
        if (photo && photo.uri) {
          setSelectedMediaUri(photo.uri);
          setActiveSubView('compose');
        }
      } catch (err) {
        setFlashTriggered(false);
        console.error('Live capture failed:', err);
        Alert.alert('Capture Failed', 'We could not take that photo. Please try again.');
      }
    } else {
      Alert.alert('Camera Not Ready', 'The camera is still starting up. Please try again in a moment.');
    }
  };

  // Opens the device photo library. This is the only path to attaching an
  // image — the compose toolbar calls it directly.
  const handleDeviceRollPick = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera roll access is required to attach images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedMediaUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error opening device gallery:', err);
      Alert.alert('Could Not Open Gallery', 'Something went wrong while opening your photos.');
    }
  };

  const renderPostItem = ({ item, index }: { item: SupabasePost; index: number }) => {
    const isAuthor = item.user_id === currentUserId;
    const authorName = getDisplayIdentity(
      { name: item.profiles?.name, anonymous_id: item.profiles?.anonymous_id },
      item.is_anonymous,
      (role as any) || 'student'
    );
    const authorRole = item.profiles?.role || 'student';
    const isCounselor = authorRole === 'counselor';
    const initials = getAuthorInitials(authorName);
    const handleTag = getHandleTag(authorName);
    const showAnonBadge = item.is_anonymous && !isAuthor && !isCounselor;

    const isContentEmpty = !item.content?.trim();
    const isImageEmpty = !item.media_url;
    const isBrokenPost = isContentEmpty && isImageEmpty;

    return (
      <View>
        <Pressable
          onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
          style={[styles.postCard, { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
          <View style={styles.postLayout}>
            {/* Left Column: Avatar */}
            <View style={styles.leftColumn}>
              {item.is_anonymous && !isCounselor ? (
                <View style={[styles.avatarCircle, { backgroundColor: theme.surfaceMuted }]}>
                  <MaterialCommunityIcons name="incognito" size={20} color={theme.textSecondary} />
                </View>
              ) : (
                <LinearGradient
                  colors={getAvatarGradient(item.user_id)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarCircle}
                >
                  <Text style={[styles.avatarText, { color: theme.textInverse }]}>{initials}</Text>
                </LinearGradient>
              )}
            </View>

            {/* Right Column: Content & Actions */}
            <View style={styles.rightColumn}>
              {/* Header info */}
              <View style={styles.authorMetaRow}>
                <View style={styles.authorInfoContainer}>
                  <Text numberOfLines={1} style={[styles.authorName, { color: theme.text }]}>
                    {authorName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.authorHandle, { color: theme.textSecondary }]}>
                    {handleTag}
                  </Text>
                  <Text style={[styles.dotDivider, { color: theme.textSecondary }]}>·</Text>
                  <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>

                <View style={styles.metaRowRight}>
                  {isCounselor && (
                    <View style={[styles.roleBadge, { backgroundColor: `${theme.primary}1D` }]}>
                      <Text style={[styles.roleText, { color: theme.primary }]}>Staff</Text>
                    </View>
                  )}

                  {showAnonBadge && (
                    <View style={[styles.roleBadge, { backgroundColor: theme.roseSoft }]}>
                      <Text style={[styles.roleText, { color: theme.rose }]}>Anon</Text>
                    </View>
                  )}

                  {isAuthor && (
                    <Pressable onPress={() => handleDeletePost(item.id)} style={styles.deleteButton}>
                      <MaterialCommunityIcons name="dots-horizontal" size={18} color={theme.textSecondary} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Post Content */}
              {isBrokenPost ? (
                <View style={[styles.fallbackContent, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.fallbackText, { color: theme.textSecondary }]}>
                    Content unavailable
                  </Text>
                </View>
              ) : (
                <>
                  {!isContentEmpty && (
                    <Text style={[styles.postContent, { color: theme.text }]}>{item.content}</Text>
                  )}
                  {!isImageEmpty && item.media_url && (
                    <PostCardImage
                      uri={item.media_url}
                      onPreview={() => setPreviewImageUrl(item.media_url || null)}
                    />
                  )}
                </>
              )}

              {/* Action Bar */}
              <View style={styles.actionBar}>
                <ActionButton
                  icon="comment-outline"
                  count={item.comments_count}
                  onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
                />
                <ActionButton
                  icon="share-variant-outline"
                  count={item.shares_count}
                  onPress={() => handleSharePost(item.id)}
                />
                <LikeButton
                  hasLiked={item.has_liked ?? false}
                  count={item.likes_count}
                  onPress={() => handleToggleLike(item.id)}
                />
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + Spacing.two,
          borderBottomColor: theme.divider,
        }
      ]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Community</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {posts.length === 0
                ? 'No posts yet'
                : `${posts.length} post${posts.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Inline composer — a feed should invite posting, not hide it behind a FAB */}
      <Pressable
        onPress={() => {
          setActiveSubView('compose');
          setComposeModalVisible(true);
        }}
        style={[styles.composerPrompt, { borderBottomColor: theme.divider }]}>
        <LinearGradient
          colors={getAvatarGradient(currentUserId)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.composerPromptAvatar}>
          <Text style={[styles.avatarText, { color: theme.textInverse }]}>
            {(userName || 'US').substring(0, 2).toUpperCase()}
          </Text>
        </LinearGradient>
        <Text style={[styles.composerPromptText, { color: theme.textSecondary }]}>
          Share something with the community…
        </Text>
        <View style={[styles.composerPromptIcon, { backgroundColor: theme.primarySoft }]}>
          <MaterialCommunityIcons name="image-outline" size={18} color={theme.primary} />
        </View>
      </Pressable>

      {/* Main List & Skeleton state */}
      {loading && posts.length === 0 ? (
        <ScrollView contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + Spacing.four }]}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFeed();
              }}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressBackgroundColor={theme.surfaceRaised}
            />
          }
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + Spacing.four }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.primarySoft }]}>
                <MaterialCommunityIcons name="message-text-outline" size={30} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Start the conversation</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Share how you&apos;re doing, ask a question, or offer someone
                encouragement. You can post anonymously.
              </Text>
              <Pressable
                onPress={() => {
                  setActiveSubView('compose');
                  setComposeModalVisible(true);
                }}
                style={[styles.emptyCta, { backgroundColor: theme.primary }]}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.onPrimary} />
                <Text style={[styles.emptyCtaText, { color: theme.onPrimary }]}>Write a post</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* Floating compose FAB button */}
      <View style={styles.composeFab}>
        <Pressable
          onPress={() => {
            setActiveSubView('compose');
            setComposeModalVisible(true);
          }}
          style={styles.fabPressable}
        >
          <LinearGradient
            colors={[theme.primary, theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <MaterialCommunityIcons name="plus" size={28} color={theme.onPrimary} />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Sliding Figma Post Composer Modal */}
      <Modal
        visible={composeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setComposeModalVisible(false)}>

        {/* SUBVIEW 1: Figma Post Composer */}
        {activeSubView === 'compose' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalScreen, { backgroundColor: theme.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider, backgroundColor: theme.surfaceRaised }]}>
              <Pressable onPress={() => setComposeModalVisible(false)} style={styles.modalCancelButton}>
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={submitting || (!newPostContent.trim() && !selectedMediaUri)}
                onPress={handleCreatePost}
                style={[
                  styles.modalPostButton,
                  {
                    backgroundColor: (!newPostContent.trim() && !selectedMediaUri)
                      ? theme.primarySoft
                      : theme.primary,
                  },
                ]}>
                <Text style={[styles.modalPostButtonText, { color: (!newPostContent.trim() && !selectedMediaUri) ? theme.textSecondary : theme.onPrimary }]}>Post</Text>
              </Pressable>
            </View>

            {/* Modal Composer ScrollView */}
            <ScrollView contentContainerStyle={styles.modalContentContainer}>
              <View style={styles.composerRow}>
                {postAsAnonymous ? (
                  <View style={[styles.composerAvatar, { backgroundColor: theme.surfaceMuted }]}>
                    <MaterialCommunityIcons name="incognito" size={20} color={theme.textSecondary} />
                  </View>
                ) : (
                  <View style={[styles.composerAvatar, { backgroundColor: role === 'counselor' ? theme.primary : theme.primarySoft }]}>
                    <Text style={styles.avatarText}>{(userName || 'US').substring(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.composerInputWrapper}>
                  <TextInput
                    value={newPostContent}
                    onChangeText={setNewPostContent}
                    placeholder="What's on your mind?"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    maxLength={280}
                    autoFocus
                    style={[styles.composerInput, { color: theme.text }]}
                  />
                </View>
              </View>

              {/* Anonymous posting toggle */}
              {role === 'student' ? (
                <View style={[styles.anonToggleRow, { borderTopColor: theme.border }]}>
                  <View style={styles.anonToggleInfo}>
                    <MaterialCommunityIcons name="incognito" size={18} color={theme.primary} />
                    <View>
                      <Text style={[styles.anonToggleLabel, { color: theme.text }]}>
                        Post as {postAsAnonymous ? (anonymousId || 'Anonymous User') : userName}
                      </Text>
                      <Text style={[styles.anonToggleHint, { color: theme.textSecondary }]}>
                        {postAsAnonymous ? 'Your real name is hidden' : 'Tap to post anonymously'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={postAsAnonymous}
                    onValueChange={setPostAsAnonymous}
                    trackColor={{ false: theme.surfaceSoft, true: `${theme.primary}40` }}
                    thumbColor={postAsAnonymous ? theme.primary : theme.surfaceSoft}
                  />
                </View>
              ) : null}

              {/* Selected Photo Preview */}
              {selectedMediaUri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: selectedMediaUri }} style={styles.previewImage} />
                  <Pressable style={styles.removePreviewButton} onPress={() => setSelectedMediaUri(null)}>
                    <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>

            {/* Modal Toolbar Attachment Dock */}
            <View style={[styles.modalToolbar, { backgroundColor: theme.surfaceRaised, borderTopColor: theme.divider }]}>
              <View style={styles.toolbarIcons}>
                {/* Device photo library */}
                <Pressable style={styles.toolbarIconBtn} onPress={handleDeviceRollPick}>
                  <MaterialCommunityIcons name="image-outline" size={24} color={theme.primary} />
                </Pressable>
                {/* Custom Camera Screen Trigger */}
                <Pressable style={styles.toolbarIconBtn} onPress={() => setActiveSubView('camera')}>
                  <MaterialCommunityIcons name="camera-outline" size={24} color={theme.primary} />
                </Pressable>
              </View>
              <Text style={[styles.charCounter, { color: theme.textSecondary }]}>
                {newPostContent.length}/280
              </Text>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* SUBVIEW 2: Custom Camera Simulator */}
        {activeSubView === 'camera' && (
          <View style={[styles.modalScreen, { backgroundColor: '#000000', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Camera Header controls */}
            <View style={styles.cameraHeader}>
              <Pressable onPress={() => setActiveSubView('compose')} style={styles.cameraCloseBtn}>
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </Pressable>
              <View style={styles.cameraHeaderRight}>
                <Pressable onPress={() => setCameraFlashActive(!cameraFlashActive)} style={styles.cameraControlIcon}>
                  <MaterialCommunityIcons
                    name={cameraFlashActive ? "flash" : "flash-off"}
                    size={24}
                    color={cameraFlashActive ? "#FFD60A" : "#FFFFFF"}
                  />
                </Pressable>
                <Pressable onPress={() => setFacing(prev => prev === 'back' ? 'front' : 'back')} style={styles.cameraControlIcon}>
                  <MaterialCommunityIcons name="camera-flip" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {/* Simulated Live Camera Finder View area */}
            <View style={styles.cameraViewfinder}>
              {cameraPermission && cameraPermission.granted ? (
                <CameraView
                  ref={cameraRef}
                  facing={facing}
                  flash={cameraFlashActive ? 'on' : 'off'}
                  style={StyleSheet.absoluteFillObject}
                />
              ) : (
                <View style={styles.permissionContainer}>
                  <Text style={styles.permissionText}>
                    Camera permission is required to stream the viewfinder.
                  </Text>
                  <Button
                    label="Grant Permission"
                    variant="primary"
                    onPress={requestCameraPermission}
                    style={styles.permissionBtn}
                  />
                </View>
              )}

              {/* Screen Flash Animation Layer */}
              {flashTriggered && <View style={styles.flashOverlay} />}
            </View>

            {/* Shutter Button and Mode Switchers */}
            <View style={styles.cameraControlsContainer}>
              {/* Shutter Trigger Button */}
              <Pressable onPress={handleCameraCapture} style={styles.shutterOuterCircle}>
                <View style={[
                  styles.shutterInnerCircle,
                  { backgroundColor: cameraMode === 'video' ? '#FF3B30' : '#D1D1D6' }
                ]} />
              </Pressable>

              {/* Switcher toggle row */}
              <View style={styles.cameraSwitcherRow}>
                <Pressable
                  style={[styles.switcherModeBtn, cameraMode === 'video' && styles.switcherModeBtnActive]}
                  onPress={() => setCameraMode('video')}>
                  <Text style={[styles.switcherModeText, cameraMode === 'video' && styles.switcherModeTextActive]}>
                    VIDEO
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.switcherModeBtn, cameraMode === 'capture' && styles.switcherModeBtnActive]}
                  onPress={() => setCameraMode('capture')}>
                  <Text style={[styles.switcherModeText, cameraMode === 'capture' && styles.switcherModeTextActive]}>
                    CAPTURE
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
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
    padding: 6,
  },
  headerTitle: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
  },
  headerSubtitle: {
    fontSize: FontSize.caption,
    marginTop: 1,
  },
  composerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  composerPromptAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerPromptText: {
    flex: 1,
    fontSize: FontSize.body,
  },
  composerPromptIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingTop: Spacing.one,
  },
  postCard: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.twoHalf,
  },
  postLayout: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  leftColumn: {
    paddingTop: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.bodySm,
  },
  rightColumn: {
    flex: 1,
    gap: Spacing.one,
  },
  authorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  authorInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
    gap: 4,
  },
  authorName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    flexShrink: 1,
  },
  authorHandle: {
    fontSize: FontSize.captionLg,
    flexShrink: 1,
  },
  dotDivider: {
    fontSize: FontSize.captionLg,
  },
  timestamp: {
    fontSize: FontSize.captionLg,
  },
  metaRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  roleText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteButton: {
    padding: 4,
  },
  postContent: {
    fontSize: FontSize.body,
    lineHeight: 22,
    marginTop: Spacing.half,
  },
  fallbackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.one,
  },
  fallbackText: {
    fontSize: FontSize.captionLg,
    fontStyle: 'italic',
  },
  postImageContainer: {
    position: 'relative',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  postImage: {
    width: '100%',
    height: 220,
  },
  imageErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    borderRadius: BorderRadius.md,
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  imageErrorText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  localUriIndicator: {
    position: 'absolute',
    bottom: Spacing.two,
    left: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: BorderRadius.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  localUriText: {
    fontSize: FontSize.caption - 1,
    fontWeight: FontWeight.bold,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    marginHorizontal: -Spacing.two,
    // Grouped left rather than spread edge-to-edge: at phone widths a
    // space-between bar strands the like button far from the post it belongs to.
    gap: Spacing.four,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  actionCount: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  // Floating Action Button
  composeFab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  fabPressable: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonLine: {
    borderRadius: BorderRadius.xs,
  },
  // Modal layout
  modalScreen: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  modalCancelButton: {
    paddingVertical: 6,
  },
  modalCancelText: {
    fontSize: FontSize.body,
  },
  modalPostButton: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPostButtonText: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.caption + 1,
  },
  modalContentContainer: {
    padding: Spacing.three,
  },
  composerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInputWrapper: {
    flex: 1,
    minHeight: 120,
  },
  composerInput: {
    fontSize: FontSize.body - 1,
    textAlignVertical: 'top',
    flex: 1,
    paddingTop: 4,
  },
  previewContainer: {
    position: 'relative',
    marginTop: Spacing.two,
    marginLeft: 44,
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: 240,
    height: 300,
    borderRadius: BorderRadius.md,
  },
  removePreviewButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
  },
  toolbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  toolbarIconBtn: {
    padding: 2,
  },
  charCounter: {
    fontSize: FontSize.caption,
  },
  // Custom Camera Simulator Layout
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  cameraCloseBtn: {
    padding: 4,
  },
  cameraHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  cameraControlIcon: {
    padding: 4,
  },
  cameraViewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#0F0F0F',
    marginHorizontal: Spacing.two,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  viewfinderText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: FontSize.caption + 1,
    marginTop: Spacing.two,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  cameraControlsContainer: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.four,
  },
  shutterOuterCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  cameraSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  switcherModeBtn: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.three,
  },
  switcherModeBtnActive: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 14,
  },
  switcherModeText: {
    color: '#8E8E93',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  switcherModeTextActive: {
    color: '#FFFFFF',
  },
  // Hardware permission components
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: '#000000',
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  permissionBtn: {
    height: 38,
    paddingHorizontal: Spacing.three,
  },
  loadingContainer: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: FontSize.caption + 1,
  },
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyTitle: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
  },
  emptySubtitle: {
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.two,
  },
  emptyCtaText: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
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
  anonToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },
  anonToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  anonToggleLabel: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.semibold,
  },
  anonToggleHint: {
    fontSize: FontSize.small,
  },
});
