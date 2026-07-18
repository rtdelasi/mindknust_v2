import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { subscribeToIncomingCalls, updateCallStatus, SupabaseCall } from '@/lib/supabase-db';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={DefaultTheme}>
        <RootLayoutContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useMockAuth();
  const [activeAlert, setActiveAlert] = useState<{ title: string; body: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<SupabaseCall | null>(null);

  // Pulse animation state for the ringing icon
  const [ringPulse, setRingPulse] = useState(1);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');
  const callChannelRef = useRef<any>(null);

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

    const playRing = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync(
          require('@/assets/sounds/incoming-ring.mp3'),
          { isLooping: true, volume: 0.8 }
        );
        sound = s;
        await sound.playAsync();
      } catch (e) {
        console.warn('[Ringtone] Could not play:', e);
      }
    };

    playRing();

    return () => {
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
    const channel = supabase
      .channel('calls-app')
      .on('broadcast', { event: 'call_hangup' }, (event) => {
        console.log('[Receiver] Received call_hangup:', event.payload);
        WebBrowser.dismissBrowser()?.catch(() => {});
      })
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, []);

  // Announcement listener
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('app-announcements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as { title: string; body: string };
          if (newNotif && newNotif.title) {
            setActiveAlert({
              title: newNotif.title,
              body: newNotif.body,
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
  }, []);

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(counselor-tabs)" />
        <Stack.Screen name="video-call" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="booking/[counselor]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>

      {/* Floating Announcement Banner */}
      {activeAlert && (
        <View style={[styles.alertBanner, { top: insets.top + 12 }]}>
          <View style={styles.alertIconWrapper}>
            <MaterialCommunityIcons name="bullhorn" size={20} color="#7B39FD" />
          </View>
          <View style={styles.alertTextWrapper}>
            <Text numberOfLines={1} style={styles.alertTitle}>
              {activeAlert.title}
            </Text>
            <Text numberOfLines={2} style={styles.alertBody}>
              {activeAlert.body}
            </Text>
          </View>
          <Pressable onPress={() => setActiveAlert(null)} style={styles.alertCloseButton}>
            <MaterialCommunityIcons name="close" size={18} color="#64748B" />
          </Pressable>
        </View>
      )}

      {/* ══════ Incoming Call Overlay ══════ */}
      {incomingCall && (
        <View style={styles.incomingOverlay}>
          <View style={[styles.incomingCard, { paddingTop: insets.top + 40 }]}>
            {/* Pulse ring behind avatar */}
            <View style={[styles.incomingPulse, { transform: [{ scale: ringPulse }] }]} />
            <Avatar name={incomingCall.caller_profile?.name || '?'} size="lg" />

            <Text style={styles.incomingCallerName}>{incomingCall.caller_profile?.name || 'Someone'}</Text>
            <Text style={styles.incomingCallType}>
              Incoming {incomingCall.call_type === 'video' ? 'Video' : 'Voice'} Call
            </Text>

            {/* Accept / Decline buttons */}
            <View style={styles.incomingActions}>
              <Pressable style={styles.declineBtn} onPress={handleDeclineCall}>
                <MaterialCommunityIcons name="phone-hangup" size={28} color="#FFFFFF" />
                <Text style={styles.incomingBtnLabel}>Decline</Text>
              </Pressable>
              <Pressable style={styles.acceptBtn} onPress={handleAcceptCall}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  alertBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: 'rgba(123, 57, 253, 0.1)',
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
    color: '#0F172A',
  },
  alertBody: {
    fontSize: 12,
    color: '#64748B',
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
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingCard: {
    alignItems: 'center',
    gap: 16,
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
  incomingCallerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  incomingCallType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 48,
    marginTop: 40,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E',
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
