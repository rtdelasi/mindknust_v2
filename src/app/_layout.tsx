import { DefaultTheme, DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemeProvider, useThemeContext } from '@/contexts/theme-context';
import { PresenceProvider } from '@/contexts/presence-context';
import { LightColors, DarkColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { getUserCreatedAt } from '@/lib/notification-state';
import {
  subscribeToIncomingCalls,
  updateCallStatus,
  fetchProfileById,
  SupabaseCall,
  SupabaseProfile,
} from '@/lib/supabase-db';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    // Must sit above the navigator: gesture handlers inside modal routes
    // (e.g. the notifications screen) render in a separate view hierarchy and
    // silently never fire without a root provider.
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutWithTheme />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutWithTheme() {
  const { mode } = useThemeContext();
  const isDark = mode === 'dark';

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme : DefaultTheme).colors,
        background: isDark ? DarkColors.background : LightColors.background,
        card: isDark ? DarkColors.surfaceRaised : LightColors.surfaceRaised,
        text: isDark ? DarkColors.text : LightColors.text,
        border: isDark ? DarkColors.border : LightColors.border,
        primary: isDark ? DarkColors.primary : LightColors.primary,
      },
    }),
    [isDark]
  );

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavThemeProvider value={navTheme}>
        <RootLayoutContent />
      </NavThemeProvider>
    </>
  );
}

function RootLayoutContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useMockAuth();
  const theme = useTheme();
  const [activeAlert, setActiveAlert] = useState<{ title: string; body: string; link?: string | null } | null>(null);
  const [incomingCall, setIncomingCall] = useState<SupabaseCall | null>(null);
  const [callerProfile, setCallerProfile] = useState<SupabaseProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);

  // Pulse animation state for the ringing icon
  const [ringPulse, setRingPulse] = useState(1);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  // Ring pulse animation
  useEffect(() => {
    if (!incomingCall) return;
    const interval = setInterval(() => {
      setRingPulse((p) => (p === 1 ? 1.2 : 1));
    }, 500);
    return () => clearInterval(interval);
  }, [incomingCall]);

  // Subscribe to incoming call invites via the calls table
  useEffect(() => {
    if (!currentUserId) return;

    const unsub = subscribeToIncomingCalls(currentUserId, (call) => {
      console.log('[Realtime Receiver] Incoming call:', call.id);
      setIncomingCall(call);
    });

    return unsub;
  }, [currentUserId]);

  // Fetch caller profile when incoming call arrives
  useEffect(() => {
    if (!incomingCall) {
      setCallerProfile(null);
      setProfileLoading(false);
      setProfileFailed(false);
      return;
    }

    // If the payload already includes caller_profile, use it directly
    if (incomingCall.caller_profile) {
      setCallerProfile(incomingCall.caller_profile);
      setProfileLoading(false);
      setProfileFailed(false);
      return;
    }

    const callerId = incomingCall.caller_id;
    if (!callerId) {
      setProfileFailed(true);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileFailed(false);

    const doFetch = async (attempts: number): Promise<void> => {
      for (let i = 0; i < attempts; i++) {
        try {
          const profile = await fetchProfileById(callerId);
          if (profile) {
            setCallerProfile(profile);
            setProfileLoading(false);
            setProfileFailed(false);
            return;
          }
        } catch (e) {
          console.warn('[IncomingCall] fetchProfile attempt', i + 1, 'failed:', e);
        }
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      setProfileLoading(false);
      setProfileFailed(true);
    };

    doFetch(3);
  }, [incomingCall]);

  // Auto-dismiss incoming call after 30 seconds
  useEffect(() => {
    if (!incomingCall) return;
    const timeout = setTimeout(() => {
      setIncomingCall(null);
    }, 30000);
    return () => clearTimeout(timeout);
  }, [incomingCall]);

  // Ringtone
  useEffect(() => {
    if (!incomingCall) return;
    let sound: Audio.Sound | null = null;
    let cancelled = false;

    const playRing = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync(
          require('@/assets/sounds/incoming-ring.mp3'),
          { isLooping: true, volume: 0.8 }
        );
        // The effect may have been torn down while createAsync was in flight;
        // unload immediately instead of leaving a looping orphan sound.
        if (cancelled) {
          await s.unloadAsync();
          return;
        }
        sound = s;
        await sound.playAsync();
      } catch (e) {
        console.warn('[Ringtone] Could not play:', e);
      }
    };

    playRing();

    return () => {
      cancelled = true;
      sound?.stopAsync();
      sound?.unloadAsync();
    };
  }, [incomingCall]);

  // Vibration
  useEffect(() => {
    if (!incomingCall) return;
    let active = true;
    const vibrate = async () => {
      while (active) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {}
        await new Promise(r => setTimeout(r, 2000));
      }
    };
    vibrate();
    return () => { active = false; };
  }, [incomingCall]);

  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall || !supabase) return;
    const saved = incomingCall;
    setIncomingCall(null);

    // Update DB status
    await updateCallStatus(saved.id, 'accepted');

    // Open Jitsi
    const videoMuted = saved.call_type === 'voice';
    const jitsiUrl = `https://meet.jit.si/${saved.room_id}#config.startWithVideoMuted=${videoMuted}&config.prejoinPageEnabled=false`;
    WebBrowser.openBrowserAsync(jitsiUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    }).catch((err) => {
      console.warn('[Receiver] Jitsi open error:', err);
      Alert.alert('Error', 'Could not open the call room.');
    });
  }, [incomingCall]);

  const handleDeclineCall = useCallback(() => {
    if (!incomingCall || !supabase) return;
    const saved = incomingCall;
    setIncomingCall(null);
    updateCallStatus(saved.id, 'declined');
  }, [incomingCall]);

  // Broadcast hang-up listener
  useEffect(() => {
    if (!supabase) return;
    const channelName = `calls-hangup-global-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'call_hangup' }, (event) => {
        console.log('[Receiver] Received call_hangup:', event.payload);
        WebBrowser.dismissBrowser()?.catch(() => {});
      })
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, []);

  // Announcement & notification listener
  useEffect(() => {
    if (!supabase) return;

    const channelName = `app-notifications-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          const newNotif = payload.new as { title: string; body: string; user_id: string | null; link?: string | null; created_at?: string };
          // Only show banner for broadcasts (user_id=null) or notifications targeted at this user
          if (newNotif && newNotif.title && (!newNotif.user_id || newNotif.user_id === currentUserId)) {
            if (currentUserId) {
              const userCreatedAt = await getUserCreatedAt(currentUserId);
              if (userCreatedAt && newNotif.created_at) {
                const notifMs = new Date(newNotif.created_at).getTime();
                const createdAtMs = new Date(userCreatedAt).getTime();
                if (!isNaN(notifMs) && !isNaN(createdAtMs) && notifMs < createdAtMs - 5000) {
                  return;
                }
              }
            }
            setActiveAlert({
              title: newNotif.title,
              body: newNotif.body,
              link: newNotif.link,
            });
            // Auto dismiss alert after 8 seconds
            setTimeout(() => {
              setActiveAlert(null);
            }, 8000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [currentUserId]);

  const isAnonDisplay = incomingCall?.is_anonymous_display === true;
  const callerName = isAnonDisplay
    ? callerProfile?.anonymous_id || 'Unknown caller'
    : callerProfile?.name || (profileFailed ? 'Caller unavailable' : 'Unknown caller');
  const hasPhoto = !isAnonDisplay && !!callerProfile?.avatar_url;

  return (
    <PresenceProvider userId={currentUserId}>
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(counselor-tabs)" />
        <Stack.Screen name="video-call" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="booking/[counselor]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>

      {/* Floating Announcement / Notification Toast Banner with Swipe-Up Dismiss */}
      {activeAlert && (
        <SwipeableNotificationToast
          alert={activeAlert}
          topOffset={insets.top + 12}
          theme={theme}
          onDismiss={() => setActiveAlert(null)}
          onPress={() => {
            const link = activeAlert.link;
            setActiveAlert(null);
            if (link) {
              router.push(link as any);
            } else if (activeAlert.title?.toLowerCase().includes('message')) {
              router.push((role === 'counselor' ? '/(counselor-tabs)/chats' : '/(tabs)/chats') as any);
            } else {
              router.push('/notifications' as any);
            }
          }}
        />
      )}

      {/* ══════ Incoming Call Overlay ══════ */}
      {incomingCall && (
        <View style={[styles.incomingOverlay, { backgroundColor: theme.background }]}>
          <View style={styles.incomingCard}>
            {/* Pulse ring behind avatar */}
            <View style={[styles.incomingPulse, { transform: [{ scale: ringPulse }] }]} />

            {/* Avatar area */}
            <View style={styles.avatarArea}>
              {profileLoading ? (
                <View style={[styles.avatarSkeleton, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                </View>
              ) : isAnonDisplay ? (
                <View style={[styles.anonAvatar, { backgroundColor: 'rgba(108,99,255,0.25)' }]}>
                  <MaterialCommunityIcons name="account-circle-outline" size={44} color="rgba(255,255,255,0.7)" />
                </View>
              ) : (
                <Avatar
                  name={callerProfile?.name}
                  size="lg"
                  source={hasPhoto ? { uri: callerProfile!.avatar_url! } : undefined}
                />
              )}
            </View>

            {/* Caller info — grouped together */}
            <View style={styles.callerInfoGroup}>
              {profileLoading ? (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={[styles.nameSkeleton, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
                  <View style={[styles.typeSkeleton, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />
                </View>
              ) : (
                <>
                  <Text style={styles.incomingCallerName}>{callerName}</Text>
                  <Text style={styles.incomingCallType}>
                    Incoming {incomingCall.call_type === 'video' ? 'Video' : 'Voice'} Call
                  </Text>
                </>
              )}
            </View>

            {/* Accept / Decline buttons */}
            <View style={styles.incomingActions}>
              <Pressable style={[styles.declineBtn, { backgroundColor: theme.error }]} onPress={handleDeclineCall}>
                <MaterialCommunityIcons name="phone-hangup" size={28} color="#FFFFFF" />
                <Text style={styles.incomingBtnLabel}>Decline</Text>
              </Pressable>
              <Pressable style={[styles.acceptBtn, { backgroundColor: theme.success }]} onPress={handleAcceptCall}>
                <MaterialCommunityIcons
                  name={incomingCall.call_type === 'video' ? 'video' : 'phone'}
                  size={28}
                  color="#FFFFFF"
                />
                <Text style={styles.incomingBtnLabel}>Accept</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
    </PresenceProvider>
  );
}

function SwipeableNotificationToast({
  alert,
  onDismiss,
  onPress,
  topOffset,
  theme,
}: {
  alert: { title: string; body: string; link?: string | null };
  onDismiss: () => void;
  onPress: () => void;
  topOffset: number;
  theme: any;
}) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 250 });
    opacity.value = withTiming(1, { duration: 250 });
  }, []);

  const dismissToast = () => {
    translateY.value = withTiming(-120, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY;
        opacity.value = Math.max(0, 1 + e.translationY / 80);
      }
    })
    .onEnd((e) => {
      if (e.translationY < -25 || e.velocityY < -300) {
        runOnJS(dismissToast)();
      } else {
        translateY.value = withTiming(0, { duration: 180 });
        opacity.value = withTiming(1, { duration: 180 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.alertBanner,
          { top: topOffset, backgroundColor: theme.surfaceRaised, borderColor: theme.border },
          animatedStyle,
        ]}>
        <Pressable onPress={onPress} style={styles.alertInnerPressable}>
          <View style={[styles.alertIconWrapper, { backgroundColor: theme.primarySoft }]}>
            <MaterialCommunityIcons
              name={alert.title?.toLowerCase().includes('message') ? 'message-text' : 'bullhorn'}
              size={20}
              color={theme.primary}
            />
          </View>
          <View style={styles.alertTextWrapper}>
            <Text numberOfLines={1} style={[styles.alertTitle, { color: theme.text }]}>
              {alert.title}
            </Text>
            <Text numberOfLines={2} style={[styles.alertBody, { color: theme.textSecondary }]}>
              {alert.body}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              runOnJS(dismissToast)();
            }}
            style={styles.alertCloseButton}>
            <MaterialCommunityIcons name="close" size={18} color={theme.textSecondary} />
          </Pressable>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  alertInnerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  alertBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    // Premium Drop Shadow
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 9999,
  },
  alertIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextWrapper: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  alertCloseButton: {
    padding: 4,
  },
  // ── Incoming Call Overlay ──
  incomingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingCard: {
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 32,
    width: '100%',
  },
  incomingPulse: {
    position: 'absolute',
    top: 30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(108, 99, 255, 0.25)',
  },
  avatarArea: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSkeleton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerInfoGroup: {
    alignItems: 'center',
    gap: 4,
  },
  incomingCallerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  incomingCallType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  nameSkeleton: {
    width: 180,
    height: 22,
    borderRadius: 6,
  },
  typeSkeleton: {
    width: 140,
    height: 14,
    borderRadius: 6,
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 48,
    marginTop: 16,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingBtnLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
});
