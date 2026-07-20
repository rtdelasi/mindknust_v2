import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { moderateContent } from '@/lib/sentiment';
import { hasSupabaseConfig } from '@/lib/supabase';
import {
  createPost,
  deletePost,
  fetchPosts,
  incrementShareCount,
  SupabasePost,
  toggleLikePost
} from '@/lib/supabase-db';
import { getPublicUrl, uploadFile } from '@/lib/supabase-storage';

const { width } = Dimensions.get('window');

// 12 Mock Gallery images matching user's Figma screenshot (umbrella, lake, dog, corgi, etc.)
const GALLERY_MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=500', // Umbrella girl
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500', // Mountain lake
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500', // Sweater girl
  'https://images.unsplash.com/photo-1525609004556-c46c7d6cf0a3?w=500', // Orange beetle car
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500', // Black dog with bandana
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500', // Curly hair girl
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500', // Ferris wheel sunset
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500', // Beach bike couple
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500', // Neon hat
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500', // Black & White portrait
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500', // Yellow background girl
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500', // Running Corgi
];

export default function SocialFeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, role } = useMockAuth();

  const [posts, setPosts] = useState<SupabasePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMediaUri, setSelectedMediaUri] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Compose Modal & Figma Views State Machine
  const [composeModalVisible, setComposeModalVisible] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'compose' | 'gallery' | 'camera'>('compose');
  const [cameraMode, setCameraMode] = useState<'video' | 'capture'>('capture');
  const [cameraFlashActive, setCameraFlashActive] = useState(false);
  const [flashTriggered, setFlashTriggered] = useState(false);

  // Hardware integration hooks
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [devicePhotos, setDevicePhotos] = useState<string[]>([]);

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

  const loadDevicePhotos = async () => {
    try {
      // Use ImagePicker (no audio permission needed) to open the device gallery
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedMediaUri(result.assets[0].uri);
        setActiveSubView('compose');
      }
    } catch (err) {
      console.error('Error opening device gallery:', err);
    }
  };

  useEffect(() => {
    if (activeSubView === 'gallery') {
      loadDevicePhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubView]);

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !selectedMediaUri) return;

    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      if (selectedMediaUri) {
        if (hasSupabaseConfig && !selectedMediaUri.startsWith('http')) {
          try {
            const response = await fetch(selectedMediaUri);
            const blob = await response.blob();
            const filename = `feed/${currentUserId}/${Date.now()}.jpg`;
            await uploadFile('social-media', filename, blob, blob.type || 'image/jpeg');
            mediaUrl = getPublicUrl('social-media', filename);
          } catch (uploadErr) {
            console.warn('Storage upload failed, using local URI fallback:', uploadErr);
            mediaUrl = selectedMediaUri;
          }
        } else {
          mediaUrl = selectedMediaUri;
        }
      }

      // Run ML content moderation (HF API → keyword fallback)
      const mod = await moderateContent(newPostContent.trim());

      if (mod.status === 'blocked') {
        Alert.alert(
          'Post Blocked',
          'Your post contains language that violates KNUST community guidelines and has been blocked.'
        );
        setSubmitting(false);
        return;
      }

      if (mod.status === 'flagged') {
        Alert.alert(
          'Support is Available',
          'Your post contains words associated with self-harm. Please remember that KNUST Counseling services are available 24/7 at 03220-60352.'
        );
      }

      const created = await createPost(currentUserId, newPostContent.trim(), mediaUrl, mod);
      if (created) {
        await loadFeed();
        setNewPostContent('');
        setSelectedMediaUri(null);
        setComposeModalVisible(false);
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
          profiles: { name: userName || 'User', role: role || 'student', avatar_url: null },
          has_liked: false,
          moderation_status: mod.status,
          is_flagged: mod.isFlagged,
          flag_reason: mod.reason || undefined
        };
        setPosts(prev => [newMockPost, ...prev]);
        setNewPostContent('');
        setSelectedMediaUri(null);
        setComposeModalVisible(false);
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
        console.warn('Live capture failed or simulator active, using fallback:', err);
        setSelectedMediaUri(GALLERY_MOCK_IMAGES[4]);
        setActiveSubView('compose');
      }
    } else {
      setFlashTriggered(true);
      setTimeout(() => {
        setFlashTriggered(false);
        setSelectedMediaUri(GALLERY_MOCK_IMAGES[4]);
        setActiveSubView('compose');
      }, 200);
    }
  };

  // Standard Imagepicker (device roll) trigger as auxiliary backup
  const handleDeviceRollPick = async () => {
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
      setActiveSubView('compose');
    }
  };

  const renderPostItem = ({ item }: { item: SupabasePost }) => {
    const isAuthor = item.user_id === currentUserId;
    const authorName = item.profiles?.name || 'Anonymous User';
    const authorRole = item.profiles?.role || 'student';
    const isCounselor = authorRole === 'counselor';
    const initials = authorName.substring(0, 2).toUpperCase();
    const handleTag = `@${authorName.toLowerCase().replace(/\s+/g, '')}`;

    return (
      <Pressable
        onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
        style={[styles.postRow, { borderBottomColor: theme.border }]}>
        <View style={styles.postLayout}>
          {/* Left Column: Avatar */}
          <View style={styles.leftColumn}>
            <View style={[styles.avatarCircle, { backgroundColor: isCounselor ? theme.primary : '#8A8FD9' }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          {/* Right Column: Content & Actions */}
          <View style={styles.rightColumn}>
            {/* Header info */}
            <View style={styles.authorMetaRow}>
              <Text numberOfLines={1} style={[styles.authorName, { color: theme.text }]}>{authorName}</Text>
              <Text numberOfLines={1} style={[styles.authorHandle, { color: theme.textSecondary }]}>{handleTag}</Text>
              <Text style={[styles.dotDivider, { color: theme.textSecondary }]}>·</Text>
              <Text style={[styles.timestamp, { color: theme.textSecondary }]}>{formatTime(item.created_at)}</Text>

              {isCounselor ? (
                <View style={[
                  styles.roleBadge,
                  { backgroundColor: `${theme.primary}1D` }
                ]}>
                  <Text style={[
                    styles.roleText,
                    { color: theme.primary }
                  ]}>
                    Staff
                  </Text>
                </View>
              ) : null}

              {isAuthor ? (
                <Pressable onPress={() => handleDeletePost(item.id)} style={styles.deleteButton}>
                  <MaterialCommunityIcons name="dots-horizontal" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {/* Post Content */}
            <Text style={[styles.postContent, { color: theme.text }]}>{item.content}</Text>

            {/* Attached Media Image */}
            {item.media_url ? (
              <Pressable onPress={() => setPreviewImageUrl(item.media_url || null)}>
                <Image source={{ uri: item.media_url }} style={styles.postImage} resizeMode="cover" />
              </Pressable>
            ) : null}

            {/* X-Style Action Bar */}
            <View style={styles.actionBar}>
              {/* Comment bubble routes to thread screen */}
              <Pressable
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
                style={styles.actionItem}>
                <MaterialCommunityIcons name="comment-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
                  {item.comments_count}
                </Text>
              </Pressable>

              {/* Share */}
              <Pressable onPress={() => handleSharePost(item.id)} style={styles.actionItem}>
                <MaterialCommunityIcons name="share-variant-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
                  {item.shares_count}
                </Text>
              </Pressable>

              {/* Like */}
              <Pressable onPress={() => handleToggleLike(item.id)} style={styles.actionItem}>
                <MaterialCommunityIcons
                  name={item.has_liked ? "heart" : "heart-outline"}
                  size={16}
                  color={item.has_liked ? "#F91880" : theme.textSecondary}
                />
                <Text style={[styles.actionCount, { color: item.has_liked ? "#F91880" : theme.textSecondary }]}>
                  {item.likes_count}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    );
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Community Hub</Text>
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={item => item.id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadFeed();
        }}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + Spacing.four }]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading timeline...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="earth-off" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Be the first to share an update with the campus community!
              </Text>
            </View>
          )
        }
      />

      {/* Floating plus FAB button to compose post */}
      <Pressable
        style={[styles.composeFab, { backgroundColor: theme.primary }]}
        onPress={() => {
          setActiveSubView('compose');
          setComposeModalVisible(true);
        }}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </Pressable>

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
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
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
                <Text style={[styles.modalPostButtonText, { color: (!newPostContent.trim() && !selectedMediaUri) ? theme.textSecondary : '#FFFFFF' }]}>Post</Text>
              </Pressable>
            </View>

            {/* Modal Composer ScrollView */}
            <ScrollView contentContainerStyle={styles.modalContentContainer}>
              <View style={styles.composerRow}>
                <View style={[styles.composerAvatar, { backgroundColor: role === 'counselor' ? theme.primary : '#8A8FD9' }]}>
                  <Text style={styles.avatarText}>{(userName || 'US').substring(0, 2).toUpperCase()}</Text>
                </View>
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
            <View style={[styles.modalToolbar, { backgroundColor: theme.surfaceRaised, borderTopColor: theme.border }]}>
              <View style={styles.toolbarIcons}>
                {/* Custom Gallery Grid Trigger */}
                <Pressable style={styles.toolbarIconBtn} onPress={() => setActiveSubView('gallery')}>
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

        {/* SUBVIEW 2: Custom Gallery Grid Selector */}
        {activeSubView === 'gallery' && (
          <View style={[styles.modalScreen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            {/* Gallery Header */}
            <View style={[styles.galleryHeader, { borderBottomColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
              <Pressable onPress={() => setActiveSubView('compose')} style={styles.galleryBackButton}>
                <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
                <Text style={[styles.galleryBackText, { color: theme.text }]}>Back</Text>
              </Pressable>
              <Text style={[styles.galleryTitle, { color: theme.text }]}>Select Media</Text>
              {/* Auxiliary native upload button */}
              <Pressable onPress={handleDeviceRollPick} style={styles.galleryUploadBtn}>
                <MaterialCommunityIcons name="file-upload-outline" size={20} color={theme.primary} />
              </Pressable>
            </View>

            {/* 3-Column Photo Grid */}
            <ScrollView contentContainerStyle={styles.galleryGridContainer}>
              <View style={styles.gridRow}>
                {devicePhotos.length > 0 ? (
                  devicePhotos.map((imgUri, index) => (
                    <Pressable
                      key={index}
                      style={styles.gridImageWrapper}
                      onPress={() => {
                        setSelectedMediaUri(imgUri);
                        setActiveSubView('compose');
                      }}>
                      <Image source={{ uri: imgUri }} style={styles.gridImage} />
                    </Pressable>
                  ))
                ) : (
                  GALLERY_MOCK_IMAGES.map((imgUri, index) => (
                    <Pressable
                      key={index}
                      style={styles.gridImageWrapper}
                      onPress={() => {
                        setSelectedMediaUri(imgUri);
                        setActiveSubView('compose');
                      }}>
                      <Image source={{ uri: imgUri }} style={styles.gridImage} />
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* SUBVIEW 3: Custom Camera Simulator */}
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
    paddingVertical: Spacing.one,
  },
  postRow: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  postLayout: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  leftColumn: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.body - 1,
  },
  rightColumn: {
    flex: 1,
    gap: Spacing.one,
  },
  authorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  authorName: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
    maxWidth: '45%',
  },
  authorHandle: {
    fontSize: FontSize.caption + 1,
    maxWidth: '30%',
  },
  dotDivider: {
    fontSize: FontSize.caption + 1,
  },
  timestamp: {
    fontSize: FontSize.caption + 1,
  },
  roleBadge: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
    marginLeft: 'auto',
    marginRight: 24, // Leave space for delete/dots trigger
  },
  roleText: {
    fontSize: FontSize.caption - 2,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  deleteButton: {
    position: 'absolute',
    right: -Spacing.one,
    top: -Spacing.one,
    padding: 6,
  },
  postContent: {
    fontSize: FontSize.body - 1,
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.two,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    paddingRight: Spacing.three,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 50,
  },
  actionCount: {
    fontSize: FontSize.caption,
  },
  // Floating Action Button
  composeFab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
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
  },
  modalCancelButton: {
    paddingVertical: 6,
  },
  modalCancelText: {
    fontSize: FontSize.body,
    color: '#000000',
  },
  modalPostButton: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPostButtonText: {
    color: '#FFFFFF',
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
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
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
    color: '#64748B',
  },
  // Custom Gallery Styling
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  galleryBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  galleryBackText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: '#000000',
  },
  galleryTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: '#000000',
  },
  galleryUploadBtn: {
    padding: 6,
  },
  galleryGridContainer: {
    paddingVertical: 1,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridImageWrapper: {
    width: width / 3 - 1,
    height: width / 3 - 1,
    margin: 0.5,
  },
  gridImage: {
    width: '100%',
    height: '100%',
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
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  emptyTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  emptySubtitle: {
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    lineHeight: 18,
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
});
