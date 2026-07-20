import { MaterialCommunityIcons } from '@expo/vector-icons';
// CameraView stubbed for Expo Go testing — restore when using dev build
let CameraView: any = null;
const useCameraPermissions = () => [
  { granted: false, canAskAgain: true, status: 'unavailable' },
  async () => ({ granted: false }),
] as any;
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  Size,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { supabase } from '@/lib/supabase';
import {
  createCall,
  updateCallStatus,
  subscribeToCallStatus,
  SupabaseCall,
} from '@/lib/supabase-db';
import { getCounselorPhoto } from './(tabs)/sessions';

type CallState = 'idle' | 'ringing' | 'connected' | 'declined' | 'missed' | 'ended';

export default function VideoCallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, userName } = useMockAuth();

  const {
    counselorName = 'Amina Owusu',
    avatarUrl,
    callType = 'video',
    counselorId = '',
  } = useLocalSearchParams<{
    counselorName: string;
    avatarUrl?: string;
    callType: 'voice' | 'video';
    counselorId: string;
  }>();

  const [callState, setCallState] = useState<CallState>('idle');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(callType === 'video');
  const [micOn, setMicOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');
  const roomId = useRef(`counselcare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
  const callIdRef = useRef<string | null>(null);
  const signalChannelRef = useRef<any>(null);
  const statusUnsubRef = useRef<(() => void) | null>(null);

  // 1. Connection timer
  useEffect(() => {
    let timer: any;
    if (callState === 'connected') {
      timer = setInterval(() => setTimeElapsed((p) => p + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // 2. Voice pulse animation
  useEffect(() => {
    if (callType === 'voice' && callState === 'connected') {
      const t = setInterval(() => setPulseScale((s) => (s === 1 ? 1.15 : 1)), 600);
      return () => clearInterval(t);
    }
  }, [callType, callState]);

  // 3. Camera permission request
  useEffect(() => {
    if (callType === 'video') {
      if (!cameraPermission) {
        requestCameraPermission();
      } else if (!cameraPermission.granted && !cameraPermission.canAskAgain) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is needed for video calls. Please enable it in your device settings.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Create call in DB + subscribe to status changes
  const callInitiated = useRef(false);

  useEffect(() => {
    if (callState !== 'ringing' || !supabase || !counselorId || callInitiated.current) return;
    callInitiated.current = true;

    const startCall = async () => {
      console.log('[VideoCall] Creating call in DB...');
      const call = await createCall(currentUserId, counselorId, callType as 'voice' | 'video', roomId);
      if (!call) {
        console.warn('[VideoCall] Failed to create call');
        setCallState('idle');
        callInitiated.current = false;
        return;
      }
      callIdRef.current = call.id;
      console.log('[VideoCall] Call created:', call.id, 'status:', call.status);

      const unsub = subscribeToCallStatus(call.id, (updated) => {
        console.log('[VideoCall] Call status updated:', updated.status);
        if (updated.status === 'accepted') {
          setCallState('connected');
          launchJitsiRoom();
        } else if (updated.status === 'declined') {
          setCallState('declined');
        } else if (updated.status === 'ended' || updated.status === 'missed') {
          setCallState(updated.status);
          WebBrowser.dismissBrowser()?.catch(() => {});
        }
      });

      statusUnsubRef.current = unsub;
    };

    startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // 5. Auto-timeout (35s)
  useEffect(() => {
    if (callState !== 'ringing' || !callIdRef.current) return;
    const timeout = setTimeout(() => {
      updateCallStatus(callIdRef.current!, 'missed');
      setCallState('missed');
    }, 35000);
    return () => clearTimeout(timeout);
  }, [callState]);

  // 6. Broadcast hang-up listener
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('calls-app')
      .on('broadcast', { event: 'call_hangup' }, (event) => {
        const payload = event.payload as { callId: string };
        if (payload.callId === callIdRef.current) {
          console.log('[VideoCall] Received call_hangup for our call');
          setCallState('ended');
          WebBrowser.dismissBrowser()?.catch(() => {});
        }
      })
      .subscribe();
    signalChannelRef.current = channel;
    return () => { supabase!.removeChannel(channel); };
  }, []);

  // 7. Cleanup on unmount
  useEffect(() => {
    return () => {
      statusUnsubRef.current?.();
      if (signalChannelRef.current && supabase) {
        supabase.removeChannel(signalChannelRef.current);
      }
    };
  }, []);

  const launchJitsiRoom = useCallback(async () => {
    const jitsiUrl = `https://meet.jit.si/${roomId}#config.startWithVideoMuted=${callType === 'voice'}&config.startWithAudioMuted=${!micOn}&config.prejoinPageEnabled=false`;
    try {
      await WebBrowser.openBrowserAsync(jitsiUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch (e) {
      console.warn('Could not open Jitsi room:', e);
      Alert.alert('Browser Error', 'Could not open the call room. Please try again.');
    }
  }, [roomId, callType, micOn]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  };

  const handleEndCall = useCallback(async () => {
    const id = callIdRef.current;
    if (id) {
      await updateCallStatus(id, 'ended');
      if (signalChannelRef.current) {
        signalChannelRef.current.send({
          type: 'broadcast',
          event: 'call_hangup',
          payload: { callId: id },
        });
      }
    }
    setCallState('ended');
    WebBrowser.dismissBrowser()?.catch(() => {});
  }, []);

  const handleCancelCall = useCallback(async () => {
    const id = callIdRef.current;
    if (id) {
      await updateCallStatus(id, 'ended');
      if (signalChannelRef.current) {
        signalChannelRef.current.send({
          type: 'broadcast',
          event: 'call_hangup',
          payload: { callId: id },
        });
      }
    }
    setCallState('ended');
  }, []);

  const cPhoto = getCounselorPhoto(counselorName, avatarUrl);
  const initials = counselorName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // ── Render: Idle / Lobby ──
  if (callState === 'idle') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background, paddingHorizontal: Spacing.four, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.lobbyHeader}>
          <Text style={[styles.lobbyTitle, { color: theme.text }]}>Pre-Call Lobby</Text>
          <Text style={[styles.lobbySub, { color: theme.textSecondary }]}>Test your audio and video before entering the room.</Text>
        </View>

        <View style={styles.lobbyPreviewBox}>
          {callType === 'video' && cameraOn && cameraPermission && cameraPermission.granted ? (
            <CameraView facing="front" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[styles.lobbyPreviewPlaceholder, { backgroundColor: theme.surfaceSoft }]}>
              <MaterialCommunityIcons
                name={callType === 'video' ? (cameraPermission && !cameraPermission.granted ? 'camera-lock' : 'camera-off') : 'microphone'}
                size={48}
                color={theme.primary}
              />
              <Text style={[styles.lobbyPlaceholderText, { color: theme.textSecondary }]}>
                {callType === 'video'
                  ? (cameraPermission && !cameraPermission.granted ? 'Camera permission denied' : 'Camera is off')
                  : 'Audio only session'}
              </Text>
              {callType === 'video' && cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain && (
                <Pressable onPress={() => requestCameraPermission()} style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: theme.primarySoft, borderRadius: 8 }}>
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Grant Permission</Text>
                </Pressable>
              )}
              {callType === 'video' && cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain && (
                <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: theme.primarySoft, borderRadius: 8 }}>
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Open Settings</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <Card variant="surface" padding="four" style={styles.lobbyControlsCard}>
          <Text style={[styles.lobbySettingsTitle, { color: theme.text }]}>Lobby checks</Text>
          <View style={styles.lobbyRow}>
            <View style={styles.lobbyRowText}>
              <Text style={[styles.lobbyRowTitle, { color: theme.text }]}>Microphone Status</Text>
              <Text style={[styles.lobbyRowSub, { color: theme.textSecondary }]}>
                {micOn ? 'Active \u2022 Capturing voice input' : 'Muted'}
              </Text>
            </View>
            <Pressable
              onPress={() => setMicOn(!micOn)}
              style={[styles.lobbyToggleBtn, { backgroundColor: micOn ? theme.primarySoft : theme.surfaceSoft }]}>
              <MaterialCommunityIcons name={micOn ? 'microphone' : 'microphone-off'} size={20} color={micOn ? theme.primary : theme.textSecondary} />
            </Pressable>
          </View>

          {callType === 'video' && (
            <View style={styles.lobbyRow}>
              <View style={styles.lobbyRowText}>
                <Text style={[styles.lobbyRowTitle, { color: theme.text }]}>Camera Status</Text>
                <Text style={[styles.lobbyRowSub, { color: theme.textSecondary }]}>
                  {cameraOn ? 'Active \u2022 Self-viewfinder enabled' : 'Disabled'}
                </Text>
              </View>
              <Pressable
                onPress={() => setCameraOn(!cameraOn)}
                style={[styles.lobbyToggleBtn, { backgroundColor: cameraOn ? theme.primarySoft : theme.surfaceSoft }]}>
                <MaterialCommunityIcons name={cameraOn ? 'camera' : 'camera-off'} size={20} color={cameraOn ? theme.primary : theme.textSecondary} />
              </Pressable>
            </View>
          )}
        </Card>

        <View style={styles.lobbyActions}>
          <Button label="Back to Dashboard" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button label="Call Now" variant="primary" onPress={() => setCallState('ringing')} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  // ── Render: Declined ──
  if (callState === 'declined') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background, paddingHorizontal: Spacing.four, justifyContent: 'center', alignItems: 'center' }]}>
        <Card variant="raised" padding="four" style={styles.endedCard}>
          <View style={[styles.endedIconBox, { backgroundColor: '#FEE2E2' }]}>
            <MaterialCommunityIcons name="phone-missed" size={44} color="#DC2626" />
          </View>
          <Text style={[styles.endedTitle, { color: theme.text }]}>Call Declined</Text>
          <Text style={[styles.endedDesc, { color: theme.textSecondary }]}>
            {counselorName} is currently unavailable. Try again later or send a message.
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two, width: '100%' }}>
            <Button label="Go Back" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button label="Retry" variant="primary" onPress={() => { setCallState('idle'); setTimeElapsed(0); callInitiated.current = false; }} style={{ flex: 1 }} />
          </View>
        </Card>
      </View>
    );
  }

  // ── Render: Missed ──
  if (callState === 'missed') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background, paddingHorizontal: Spacing.four, justifyContent: 'center', alignItems: 'center' }]}>
        <Card variant="raised" padding="four" style={styles.endedCard}>
          <View style={[styles.endedIconBox, { backgroundColor: '#FEF3C7' }]}>
            <MaterialCommunityIcons name="phone-missed" size={44} color="#D97706" />
          </View>
          <Text style={[styles.endedTitle, { color: theme.text }]}>No Answer</Text>
          <Text style={[styles.endedDesc, { color: theme.textSecondary }]}>
            No one answered. Try again later or send a message.
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two, width: '100%' }}>
            <Button label="Go Back" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button label="Retry" variant="primary" onPress={() => { setCallState('idle'); setTimeElapsed(0); callInitiated.current = false; }} style={{ flex: 1 }} />
          </View>
        </Card>
      </View>
    );
  }

  // ── Render: Ended / Summary ──
  if (callState === 'ended') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background, paddingHorizontal: Spacing.four, justifyContent: 'center', alignItems: 'center' }]}>
        <Card variant="raised" padding="four" style={styles.endedCard}>
          <View style={[styles.endedIconBox, { backgroundColor: `${theme.primary}1A` }]}>
            <MaterialCommunityIcons name="phone-check" size={44} color={theme.primary} />
          </View>
          <Text style={[styles.endedTitle, { color: theme.text }]}>Consultation Completed</Text>
          <Text style={[styles.endedDesc, { color: theme.textSecondary }]}>
            Your wellness consultation session has concluded successfully.
          </Text>

          <View style={[styles.summaryBox, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Participant:</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{counselorName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Session Type:</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{callType === 'video' ? 'Video Care' : 'Voice Check'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Duration:</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatTimer(timeElapsed)}</Text>
            </View>
          </View>

          <Button label="Close Call Room" variant="primary" onPress={() => router.back()} style={styles.endedBtn} />
        </Card>
      </View>
    );
  }

  // ── Render: Ringing or Connected ──
  const isConnected = callState === 'connected';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingHorizontal: Spacing.four }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <Pressable style={[styles.circleButton, { backgroundColor: theme.surfaceRaised }]} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={Size.iconLg} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {callType === 'video' ? 'Video Care Room' : 'Voice Care Room'}
        </Text>
        <Pressable style={[styles.circleButton, { backgroundColor: theme.surfaceRaised }]}>
          <MaterialCommunityIcons name="dots-vertical" size={Size.iconMd} color={theme.text} />
        </Pressable>
      </View>

      {/* Main viewport */}
      <View style={styles.heroWrap}>
        <Card variant="raised" padding="four" style={[styles.heroCard, { backgroundColor: theme.primarySoft, borderColor: theme.primarySoft }]}>

          {/* Tag status */}
          <View style={[styles.sessionTag, { backgroundColor: theme.surfaceRaised }]}>
            <MaterialCommunityIcons name={callType === 'video' ? 'video-outline' : 'phone-outline'} size={Size.iconSm} color={theme.primary} />
            <Text style={[styles.sessionTagText, { color: theme.text }]}>
              {callState.toUpperCase()}
            </Text>
          </View>

          {callState === 'ringing' ? (
            /* Ringing placeholder screen */
            <View style={[styles.portraitFrame, { backgroundColor: theme.surfaceRaised, justifyContent: 'center', alignItems: 'center' }]}>
              <View style={[styles.pulseCircle, { transform: [{ scale: pulseScale }], backgroundColor: `${theme.primary}1F` }]} />
              <Avatar name={counselorName} size="lg" source={{ uri: cPhoto }} />
              <Text style={[styles.voiceConnectedText, { color: theme.text, marginTop: Spacing.three }]}>
                Calling {counselorName}...
              </Text>
              <Text style={[styles.voiceStatusText, { color: theme.textSecondary, marginTop: Spacing.one }]}>
                Waiting for answer
              </Text>
            </View>
          ) : callType === 'video' ? (
            /* Video Streaming active viewport */
            <View style={[styles.portraitFrame, { backgroundColor: theme.surfaceRaised }]}>
              {avatarUrl || cPhoto ? (
                <Avatar name={counselorName} size="lg" source={{ uri: cPhoto }} />
              ) : (
                <>
                  <View style={[styles.portraitGlow, { backgroundColor: theme.accentSoft }]} />
                  <Text style={[styles.portraitInitials, { color: theme.primary }]}>{initials}</Text>
                </>
              )}
              <Text style={[styles.remoteLabel, { color: theme.textSecondary }]}>{counselorName} (Counselor)</Text>
            </View>
          ) : (
            /* Voice Streaming active viewport */
            <View style={[styles.portraitFrame, { backgroundColor: theme.surfaceRaised, justifyContent: 'center', alignItems: 'center' }]}>
              <View style={[styles.pulseCircle, { transform: [{ scale: pulseScale }], backgroundColor: `${theme.primary}1F` }]} />
              <Avatar name={counselorName} size="lg" source={{ uri: cPhoto }} />
              <Text style={[styles.voiceConnectedText, { color: theme.text, marginTop: Spacing.three }]}>{counselorName}</Text>
              <Text style={[styles.voiceStatusText, { color: theme.textSecondary, marginTop: Spacing.one }]}>Voice stream connected</Text>
            </View>
          )}

          {/* Picture in Picture viewfinder preview (only when connected and video) */}
          {isConnected && callType === 'video' && cameraOn && cameraPermission && cameraPermission.granted ? (
            <View style={styles.floatingSelfFrame}>
              <CameraView facing="front" style={StyleSheet.absoluteFillObject} />
              <View style={styles.selfLabelBadge}>
                <Text style={styles.selfLabelBadgeText}>You (Self)</Text>
              </View>
            </View>
          ) : isConnected && callType === 'video' ? (
            <View style={[styles.floatingSelfFrame, { backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <MaterialCommunityIcons name="camera-off" size={16} color={theme.textSecondary} />
              <Text style={{ fontSize: 8, color: theme.textSecondary, marginTop: 2 }}>Self Off</Text>
            </View>
          ) : null}

          {/* Call Meta Banner Overlay */}
          <View style={[styles.callStrip, { backgroundColor: theme.surfaceRaised }]}>
            <View style={styles.callMeta}>
              <Avatar name={counselorName} size="sm" source={{ uri: cPhoto }} />
              <View>
                <Text style={[styles.callerName, { color: theme.text }]}>{counselorName}</Text>
                <Text style={[styles.callerRole, { color: theme.textSecondary }]}>Student Advisor</Text>
              </View>
            </View>
            <View style={[styles.timerPill, { backgroundColor: theme.surfaceSoft }]}>
              <View style={styles.liveDot} />
              <Text style={[styles.timerText, { color: theme.text }]}>{formatTimer(timeElapsed)}</Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Re-open Jitsi room button (only when connected) */}
      {isConnected && (
        <Pressable onPress={launchJitsiRoom} style={[styles.testBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
          <MaterialCommunityIcons name="open-in-new" size={14} color={theme.primary} />
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: 'bold', marginLeft: 4 }}>Open Call Room</Text>
        </Pressable>
      )}

      {/* Control panel buttons */}
      {isConnected ? (
        <View style={[styles.controlsWrap, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.controlsRow}>
            <ControlButton
              icon={cameraOn ? 'camera' : 'camera-off'}
              label="Camera"
              active={cameraOn}
              onPress={() => setCameraOn(!cameraOn)}
              disabled={callType === 'voice'}
            />
            <ControlButton
              icon={micOn ? 'microphone' : 'microphone-off'}
              label={micOn ? 'Mute' : 'Unmute'}
              active={micOn}
              onPress={() => setMicOn(!micOn)}
            />
            <ControlButton
              icon="phone-hangup"
              label="End"
              danger
              onPress={handleEndCall}
            />
            <ControlButton
              icon={audioOn ? 'volume-high' : 'volume-off'}
              label="Speaker"
              active={audioOn}
              onPress={() => setAudioOn(!audioOn)}
            />
            <ControlButton
              icon="share-outline"
              label="Share"
              onPress={() => Alert.alert('Share Link', 'Room invitation link copied to clipboard!')}
            />
          </View>
          <Button label="Back to sessions" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        /* Ringing controls — just Cancel */
        <View style={[styles.controlsWrap, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.controlsRow}>
            <ControlButton
              icon={cameraOn ? 'camera' : 'camera-off'}
              label="Camera"
              active={cameraOn}
              onPress={() => setCameraOn(!cameraOn)}
              disabled
            />
            <ControlButton
              icon={micOn ? 'microphone' : 'microphone-off'}
              label={micOn ? 'Mute' : 'Unmute'}
              active={micOn}
              onPress={() => setMicOn(!micOn)}
              disabled
            />
            <ControlButton
              icon="phone-hangup"
              label="Cancel"
              danger
              onPress={handleCancelCall}
            />
            <ControlButton
              icon={audioOn ? 'volume-high' : 'volume-off'}
              label="Speaker"
              active={audioOn}
              onPress={() => setAudioOn(!audioOn)}
              disabled
            />
            <ControlButton
              icon="share-outline"
              label="Share"
              onPress={() => Alert.alert('Share Link', 'Room invitation link copied to clipboard!')}
              disabled
            />
          </View>
          <Button label="Back to sessions" variant="secondary" onPress={() => router.back()} />
        </View>
      )}
    </View>
  );
}

function ControlButton({
  icon,
  label,
  danger,
  active,
  onPress,
  disabled,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  danger?: boolean;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.controlButton,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
        active && !danger && { backgroundColor: theme.primary, borderColor: theme.primary },
        danger && styles.dangerButton,
        disabled && { opacity: 0.3 },
      ]}>
      <MaterialCommunityIcons
        name={icon}
        size={Size.iconMd}
        color={danger || (active && !disabled) ? '#FFFFFF' : theme.primary}
      />
      <Text style={[styles.controlLabel, { color: theme.textSecondary }, danger && styles.dangerLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  lobbyHeader: {
    gap: Spacing.one,
    marginTop: Spacing.four,
  },
  lobbyTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  lobbySub: {
    fontSize: FontSize.caption + 1,
    lineHeight: 18,
  },
  lobbyPreviewBox: {
    height: 240,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: Spacing.four,
  },
  lobbyPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  lobbyPlaceholderText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  lobbyControlsCard: {
    borderRadius: BorderRadius.md,
    gap: Spacing.three,
  },
  lobbySettingsTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  lobbyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  lobbyRowText: {
    gap: 2,
    flex: 1,
  },
  lobbyRowTitle: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.bold,
  },
  lobbyRowSub: {
    fontSize: FontSize.caption,
  },
  lobbyToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  endedCard: {
    width: '100%',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.04)',
    gap: Spacing.four,
  },
  endedIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  endedDesc: {
    fontSize: FontSize.caption + 1,
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
    lineHeight: 18,
  },
  summaryBox: {
    width: '100%',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
  },
  summaryValue: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  endedBtn: {
    width: '100%',
    borderRadius: BorderRadius.full,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerTitle: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
  },
  circleButton: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: Spacing.two,
  },
  heroCard: {
    flex: 1,
    gap: Spacing.three,
    position: 'relative',
  },
  reconnectBanner: {
    position: 'absolute',
    top: 58,
    left: Spacing.three,
    right: Spacing.three,
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    zIndex: 30,
  },
  reconnectText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  sessionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    zIndex: 10,
  },
  sessionTagText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  portraitFrame: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  portraitGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.8,
  },
  portraitInitials: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -2,
    zIndex: 1,
  },
  remoteLabel: {
    position: 'absolute',
    bottom: Spacing.three,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  pulseCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  voiceConnectedText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  voiceStatusText: {
    fontSize: FontSize.caption,
  },
  floatingSelfFrame: {
    position: 'absolute',
    top: 58,
    right: Spacing.three,
    width: 100,
    height: 140,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 20,
  },
  selfLabelBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  selfLabelBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: FontWeight.bold,
  },
  callStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
    zIndex: 10,
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  callerName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  callerRole: {
    fontSize: FontSize.caption,
    marginTop: 1,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5050',
  },
  timerText: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  testBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginVertical: 4,
  },
  controlsWrap: {
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  controlButton: {
    width: 58,
    height: 58,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dangerButton: {
    backgroundColor: '#F04444',
    borderColor: '#F04444',
  },
  controlLabel: {
    position: 'absolute',
    bottom: -18,
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  dangerLabel: {
    color: '#F04444',
  },
});
