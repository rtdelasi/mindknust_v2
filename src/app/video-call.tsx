import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HMSVideoViewMode, HMSConstants } from '@100mslive/react-native-hms';
import { HmsViewComponent } from '@100mslive/react-native-hms/src/classes/HmsView';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  BorderRadius,
  FontSize,
  FontWeight,
  Spacing,
} from '@/constants/theme';
import { getCounselorPhoto } from '@/lib/counselor-utils';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { supabase } from '@/lib/supabase';
import {
  createCall,
  subscribeToCallStatus,
  updateCallStatus,
} from '@/lib/supabase-db';
import {
  WebRTCSignalingManager,
  WebRTCSignalingEvent,
} from '@/lib/webrtc-signaling';
import { useTheme } from '@/hooks/use-theme';

type CallState = 'idle' | 'ringing' | 'connected' | 'declined' | 'missed' | 'ended';

interface PeerMediaState {
  micOn: boolean;
  cameraOn: boolean;
  facing: 'front' | 'back';
  trackId?: string;
  videoTrack?: { trackId: string };
}

export default function VideoCallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, userName } = useMockAuth();

  const {
    counselorName = '',
    callerNameParam = '',
    avatarUrl,
    callType = 'video',
    counselorId = '',
    roomId: passedRoomId,
    callId: passedCallId,
    isIncomingAccepted = 'false',
  } = useLocalSearchParams<{
    counselorName?: string;
    callerNameParam?: string;
    avatarUrl?: string;
    callType?: 'voice' | 'video';
    counselorId?: string;
    roomId?: string;
    callId?: string;
    isIncomingAccepted?: string;
  }>();

  const isStudent = role === 'student';

  // ── Precise Identity Resolution ──
  // Local user identity
  const localPeerName = userName || (role === 'counselor' ? 'Dr. Kwame Boateng' : 'Richmond');
  const localPeerRole = role === 'counselor' ? 'Counselor' : 'Student';

  // Remote peer identity
  const rawParamName = callerNameParam || counselorName || '';
  let remotePeerName = isStudent
    ? (rawParamName && rawParamName !== localPeerName ? rawParamName : 'Dr. Amina Owusu')
    : (rawParamName && rawParamName !== localPeerName ? rawParamName : 'Student Member');

  if (remotePeerName === localPeerName) {
    remotePeerName = isStudent ? 'Dr. Amina Owusu' : 'Student Member';
  }

  const remotePeerRole = isStudent ? 'Counselor' : 'Student Member';
  const remoteAvatarSource = isStudent
    ? { uri: getCounselorPhoto(remotePeerName, avatarUrl) }
    : avatarUrl
      ? { uri: avatarUrl }
      : undefined;

  const [callState, setCallState] = useState<CallState>(
    isIncomingAccepted === 'true'
      ? 'connected'
      : counselorId || passedRoomId
      ? 'ringing'
      : 'idle'
  );
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(callType === 'video');
  const [micOn, setMicOn] = useState(true);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);

  // Remote peer state received via WebRTC P2P Signaling
  const [peerState, setPeerState] = useState<PeerMediaState>({
    micOn: true,
    cameraOn: callType === 'video',
    facing: 'front',
  });

  const currentUserId =
    auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  const localTrackIdRef = useRef(`vtrack_${currentUserId}_${Date.now()}`);

  // ── Remote Track Resolution (100ms HMS / WebRTC Integration) ──
  let hmsPeers: any[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hmsModule = require('@100mslive/react-native-hms');
    if (hmsModule?.useHMSPeers) {
      hmsPeers = hmsModule.useHMSPeers();
    }
  } catch (_e) {}

  const remoteHmsPeer = hmsPeers?.find((p: any) => !p.isLocal);
  const realTrackId =
    remoteHmsPeer?.videoTrack?.trackId ||
    peerState.trackId ||
    peerState.videoTrack?.trackId;

  const defaultRoomId = useRef(
    `counselcare-webrtc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ).current;

  const activeRoomId = passedRoomId || defaultRoomId;
  const callIdRef = useRef<string | null>(passedCallId || null);
  const signalingRef = useRef<WebRTCSignalingManager | null>(null);
  const statusUnsubRef = useRef<(() => void) | null>(null);

  // 1. Audio mode configuration for native speakerphone & microphone capture
  useEffect(() => {
    if (callState === 'connected') {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch((err) => console.warn('[VideoCall] Audio setup error:', err));
    }
  }, [callState]);

  // 2. Connection timer
  useEffect(() => {
    let timer: any;
    if (callState === 'connected') {
      timer = setInterval(() => setTimeElapsed((p) => p + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // 3. Pulse animation for voice calls
  useEffect(() => {
    if (callType === 'voice' && callState === 'connected') {
      const t = setInterval(() => setPulseScale((s) => (s === 1 ? 1.18 : 1)), 500);
      return () => clearInterval(t);
    }
  }, [callType, callState]);

  // 4. Camera permission check
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
  }, [callType]);

  // 5. WebRTC P2P Signaling Engine Setup
  useEffect(() => {
    if (!activeRoomId || !currentUserId) return;

    const signaling = new WebRTCSignalingManager(activeRoomId, currentUserId);
    signalingRef.current = signaling;

    signaling.connect((event: WebRTCSignalingEvent) => {
      console.log('[WebRTC Engine] Received signaling event:', event.type);
      if (event.type === 'offer') {
        signaling.sendAnswer({ sdp: 'v=0\r\no=- WebRTC P2P Session', type: 'answer' });
        setCallState('connected');
      } else if (event.type === 'answer') {
        setCallState('connected');
      } else if (event.type === 'media-state') {
        if (event.payload) {
          setPeerState(event.payload);
        }
      } else if (event.type === 'hangup') {
        setCallState('ended');
      }
    });

    return () => {
      signaling.disconnect();
    };
  }, [activeRoomId, currentUserId]);

  // Broadcast local media state changes to remote peer
  useEffect(() => {
    if (callState === 'connected' && signalingRef.current) {
      signalingRef.current.sendMediaState({
        micOn,
        cameraOn,
        facing,
        trackId: localTrackIdRef.current,
      });
    }
  }, [micOn, cameraOn, facing, callState]);

  // 6. Create call in DB + subscribe to status changes
  const callInitiated = useRef(false);

  useEffect(() => {
    if (callState !== 'ringing' || !supabase || !counselorId || callInitiated.current) return;
    callInitiated.current = true;

    const startCall = async () => {
      console.log('[VideoCall] Creating call in DB...');
      const call = await createCall(currentUserId, counselorId, callType as 'voice' | 'video', activeRoomId);
      if (!call) {
        console.warn('[VideoCall] Failed to create call');
        setCallState('idle');
        callInitiated.current = false;
        return;
      }
      callIdRef.current = call.id;

      if (signalingRef.current) {
        signalingRef.current.sendOffer({ sdp: 'v=0\r\no=- WebRTC P2P Session', type: 'offer' });
      }

      const unsub = subscribeToCallStatus(call.id, (updated) => {
        if (updated.status === 'accepted') {
          setCallState('connected');
        } else if (updated.status === 'declined') {
          setCallState('declined');
        } else if (updated.status === 'ended' || updated.status === 'missed') {
          setCallState(updated.status);
        }
      });

      statusUnsubRef.current = unsub;
    };

    startCall();
  }, [callState, counselorId, currentUserId, callType, activeRoomId]);

  // If incoming call accepted, subscribe to call status
  useEffect(() => {
    if (callState === 'connected' && callIdRef.current && !statusUnsubRef.current && supabase) {
      const unsub = subscribeToCallStatus(callIdRef.current, (updated) => {
        if (updated.status === 'ended' || updated.status === 'declined' || updated.status === 'missed') {
          setCallState(updated.status);
        }
      });
      statusUnsubRef.current = unsub;
    }
  }, [callState]);

  // 7. Auto-timeout for ringing (35s)
  useEffect(() => {
    if (callState !== 'ringing' || !callIdRef.current) return;
    const timeout = setTimeout(() => {
      updateCallStatus(callIdRef.current!, 'missed');
      setCallState('missed');
    }, 35000);
    return () => clearTimeout(timeout);
  }, [callState]);

  // 8. Cleanup on unmount
  useEffect(() => {
    return () => {
      statusUnsubRef.current?.();
      signalingRef.current?.disconnect();
    };
  }, []);

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
    }
    if (signalingRef.current) {
      signalingRef.current.sendHangup();
    }
    setCallState('ended');
  }, []);

  // ── Render: Idle / Lobby ──
  if (callState === 'idle') {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            paddingHorizontal: Spacing.four,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}>
        <View style={styles.lobbyHeader}>
          <Text style={[styles.lobbyTitle, { color: theme.text }]}>Pre-Call Lobby</Text>
          <Text style={[styles.lobbySub, { color: theme.textSecondary }]}>
            Test your hardware before establishing peer-to-peer connection with {remotePeerName}.
          </Text>
        </View>

        <View style={styles.lobbyPreviewBox}>
          {callType === 'video' && cameraOn && cameraPermission && cameraPermission.granted ? (
            <CameraView facing={facing} style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[styles.lobbyPreviewPlaceholder, { backgroundColor: theme.surfaceSoft }]}>
              <MaterialCommunityIcons
                name={
                  callType === 'video'
                    ? cameraPermission && !cameraPermission.granted
                      ? 'camera-lock'
                      : 'camera-off'
                    : 'microphone'
                }
                size={48}
                color={theme.primary}
              />
              <Text style={[styles.lobbyPlaceholderText, { color: theme.textSecondary }]}>
                {callType === 'video'
                  ? cameraPermission && !cameraPermission.granted
                    ? 'Camera permission denied'
                    : 'Camera is off'
                  : 'Audio only session'}
              </Text>
              {callType === 'video' && cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain && (
                <Pressable
                  onPress={() => requestCameraPermission()}
                  style={{
                    marginTop: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 16,
                    backgroundColor: theme.primarySoft,
                    borderRadius: 8,
                  }}>
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>
                    Grant Permission
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <Card variant="surface" padding="four" style={styles.lobbyControlsCard}>
          <Text style={[styles.lobbySettingsTitle, { color: theme.text }]}>Hardware Checks</Text>
          <View style={styles.lobbyRow}>
            <View style={styles.lobbyRowText}>
              <Text style={[styles.lobbyRowTitle, { color: theme.text }]}>Microphone Input</Text>
              <Text style={[styles.lobbyRowSub, { color: theme.textSecondary }]}>
                {micOn ? 'Active • Capturing voice' : 'Muted'}
              </Text>
            </View>
            <Pressable
              onPress={() => setMicOn(!micOn)}
              style={[
                styles.lobbyToggleBtn,
                { backgroundColor: micOn ? theme.primarySoft : theme.surfaceSoft },
              ]}>
              <MaterialCommunityIcons
                name={micOn ? 'microphone' : 'microphone-off'}
                size={20}
                color={micOn ? theme.primary : theme.textSecondary}
              />
            </Pressable>
          </View>

          {callType === 'video' && (
            <View style={styles.lobbyRow}>
              <View style={styles.lobbyRowText}>
                <Text style={[styles.lobbyRowTitle, { color: theme.text }]}>Camera Preview</Text>
                <Text style={[styles.lobbyRowSub, { color: theme.textSecondary }]}>
                  {cameraOn ? 'Active • Self viewfinder enabled' : 'Disabled'}
                </Text>
              </View>
              <Pressable
                onPress={() => setCameraOn(!cameraOn)}
                style={[
                  styles.lobbyToggleBtn,
                  { backgroundColor: cameraOn ? theme.primarySoft : theme.surfaceSoft },
                ]}>
                <MaterialCommunityIcons
                  name={cameraOn ? 'camera' : 'camera-off'}
                  size={20}
                  color={cameraOn ? theme.primary : theme.textSecondary}
                />
              </Pressable>
            </View>
          )}
        </Card>

        <View style={styles.lobbyActions}>
          <Button label="Back" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button label="Start Call" variant="primary" onPress={() => setCallState('ringing')} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  // ── Render: Declined ──
  if (callState === 'declined') {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            paddingHorizontal: Spacing.four,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}>
        <Card variant="raised" padding="four" style={styles.endedCard}>
          <View style={[styles.endedIconBox, { backgroundColor: theme.errorSoft }]}>
            <MaterialCommunityIcons name="phone-missed" size={44} color={theme.error} />
          </View>
          <Text style={[styles.endedTitle, { color: theme.text }]}>Call Declined</Text>
          <Text style={[styles.endedDesc, { color: theme.textSecondary }]}>
            {remotePeerName} is currently unavailable. Try again later or send a message.
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two, width: '100%' }}>
            <Button label="Go Back" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button
              label="Retry"
              variant="primary"
              onPress={() => {
                setCallState('idle');
                setTimeElapsed(0);
                callInitiated.current = false;
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </View>
    );
  }

  // ── Render: Missed ──
  if (callState === 'missed') {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            paddingHorizontal: Spacing.four,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}>
        <Card variant="raised" padding="four" style={styles.endedCard}>
          <View style={[styles.endedIconBox, { backgroundColor: theme.warningSoft }]}>
            <MaterialCommunityIcons name="phone-missed" size={44} color={theme.warning} />
          </View>
          <Text style={[styles.endedTitle, { color: theme.text }]}>No Answer</Text>
          <Text style={[styles.endedDesc, { color: theme.textSecondary }]}>
            No answer received from {remotePeerName}. Try again later.
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two, width: '100%' }}>
            <Button label="Go Back" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
            <Button
              label="Retry"
              variant="primary"
              onPress={() => {
                setCallState('idle');
                setTimeElapsed(0);
                callInitiated.current = false;
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </View>
    );
  }

  // ── Render: Ended / Summary ──
  if (callState === 'ended') {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            paddingHorizontal: Spacing.four,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}>
        <Card variant="raised" padding="four" style={styles.endedCard}>
          <View style={[styles.endedIconBox, { backgroundColor: `${theme.primary}1A` }]}>
            <MaterialCommunityIcons name="phone-check" size={44} color={theme.primary} />
          </View>
          <Text style={[styles.endedTitle, { color: theme.text }]}>Consultation Completed</Text>
          <Text style={[styles.endedDesc, { color: theme.textSecondary }]}>
            Your consultation session with {remotePeerName} has concluded.
          </Text>

          <View style={[styles.summaryBox, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Participant:</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{remotePeerName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Session Type:</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {callType === 'video' ? 'WebRTC Video Care' : 'WebRTC Voice Check'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Duration:</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatTimer(timeElapsed)}</Text>
            </View>
          </View>

          <Button label="Back to sessions" variant="primary" onPress={() => router.back()} style={styles.endedBtn} />
        </Card>
      </View>
    );
  }

  // ── Render: Ringing View ──
  if (callState === 'ringing') {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            paddingHorizontal: Spacing.four,
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.four,
          },
        ]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {callType === 'video' ? 'WebRTC Video Calling' : 'WebRTC Voice Calling'}
          </Text>
        </View>

        <View style={styles.ringingContainer}>
          <View style={[styles.pulseCircle, { transform: [{ scale: pulseScale }], backgroundColor: `${theme.primary}1F` }]} />
          <Avatar name={remotePeerName} size="lg" source={remoteAvatarSource} />
          <Text style={[styles.ringingName, { color: theme.text }]}>
            Calling {remotePeerName}...
          </Text>
          <Text style={[styles.ringingSub, { color: theme.textSecondary }]}>
            Exchanging SDP WebRTC signals
          </Text>
        </View>

        <View style={styles.ringingActions}>
          <Pressable onPress={handleEndCall} style={[styles.hangupBtn, { backgroundColor: theme.error }]}>
            <MaterialCommunityIcons name="phone-hangup" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Render: WebRTC P2P Connected Call View ──
  return (
    <View style={[styles.screen, { backgroundColor: '#0B0F19' }]}>
      {/* On-Screen DEV Debug Overlay */}
      {__DEV__ && (
        <View style={[styles.devDebugOverlay, { top: insets.top + 4 }]}>
          <Text style={styles.devDebugText}>
            [DEV DEBUG] Remote: {remotePeerName} ({remotePeerRole}) | Video: {peerState.cameraOn ? 'Active' : 'Off'} | Mic: {peerState.micOn ? 'Active' : 'Muted'}
          </Text>
          <Text style={styles.devDebugText}>
            Local: {localPeerName} ({localPeerRole}) | Video: {cameraOn ? 'Active' : 'Off'} | Mic: {micOn ? 'Active' : 'Muted'}
          </Text>
        </View>
      )}

      {/* Top WebRTC Header */}
      <View
        style={[
          styles.webrtcHeader,
          { paddingTop: insets.top + (__DEV__ ? 42 : 8), backgroundColor: 'rgba(11, 15, 25, 0.9)' },
        ]}>
        <View style={styles.webrtcHeaderLeft}>
          <Avatar name={remotePeerName} size="sm" source={remoteAvatarSource} />
          <View>
            <Text style={styles.webrtcHeaderName}>{remotePeerName}</Text>
            <Text style={styles.webrtcHeaderTimer}>{formatTimer(timeElapsed)}</Text>
          </View>
        </View>

        <View style={styles.webrtcHeaderRight}>
          <View style={styles.secureBadge}>
            <MaterialCommunityIcons name="lock-check-outline" size={14} color="#10B981" />
            <Text style={styles.secureBadgeText}>WebRTC P2P</Text>
          </View>
        </View>
      </View>

      {/* Main Media Canvas Viewport (Displays Remote Peer Card / Stream) */}
      <View style={styles.webrtcCanvas}>
        {callType === 'video' ? (
          peerState.cameraOn && realTrackId ? (
            (() => {
              console.log('[VideoDebug] rendering HmsView with trackId:', realTrackId);
              return (
                <View style={styles.remoteVideoCanvas}>
                  <HmsViewComponent
                    key={realTrackId}
                    trackId={realTrackId}
                    id={HMSConstants?.DEFAULT_SDK_ID || '100ms_sdk_id'}
                    style={StyleSheet.absoluteFillObject}
                    scaleType={HMSVideoViewMode.ASPECT_FILL}
                    mirror={false}
                    setZOrderMediaOverlay={false}
                  />
                </View>
              );
            })()
          ) : (
            /* Remote Participant Camera Off / Unattached Track Placeholder */
            <View style={styles.videoOffPlaceholder}>
              <Avatar name={remotePeerName} size="xl" source={remoteAvatarSource} />
              <Text style={styles.videoOffText}>{remotePeerName}</Text>
              <Text style={styles.videoOffSub}>
                {!peerState.cameraOn ? `${remotePeerRole} turned off camera` : 'Connecting video stream...'}
              </Text>
            </View>
          )
        ) : (
          /* Native Voice Room Container */
          <View style={styles.webrtcVoiceContainer}>
            <View
              style={[
                styles.webrtcVoicePulseCircle,
                { transform: [{ scale: pulseScale }], backgroundColor: 'rgba(99, 102, 241, 0.18)' },
              ]}
            />
            <Avatar name={remotePeerName} size="xl" source={remoteAvatarSource} />
            <Text style={styles.webrtcVoiceName}>{remotePeerName}</Text>
            <Text style={styles.webrtcVoiceSub}>
              {peerState.micOn ? `${remotePeerRole} • Voice Stream Connected` : `${remotePeerName} (Muted)`}
            </Text>
          </View>
        )}

        {/* Floating Local Camera PIP Viewport */}
        {callType === 'video' && (
          <View style={styles.floatingPipBox}>
            {cameraOn && cameraPermission?.granted ? (
              <CameraView facing={facing} style={StyleSheet.absoluteFillObject} />
            ) : (
              <View style={styles.pipCameraOffBox}>
                <MaterialCommunityIcons name="camera-off" size={24} color="#94A3B8" />
              </View>
            )}
            <View style={styles.pipLabelTag}>
              <Text style={styles.pipLabelText}>You ({cameraOn ? 'Local Camera' : 'Camera Off'})</Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Media Control Action Bar */}
      <View style={[styles.webrtcControlsBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => setMicOn(!micOn)}
          style={[
            styles.webrtcControlBtn,
            { backgroundColor: micOn ? 'rgba(255,255,255,0.15)' : theme.error },
          ]}>
          <MaterialCommunityIcons
            name={micOn ? 'microphone' : 'microphone-off'}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.webrtcControlLabel}>{micOn ? 'Mute' : 'Muted'}</Text>
        </Pressable>

        {callType === 'video' && (
          <Pressable
            onPress={() => setCameraOn(!cameraOn)}
            style={[
              styles.webrtcControlBtn,
              { backgroundColor: cameraOn ? 'rgba(255,255,255,0.15)' : theme.error },
            ]}>
            <MaterialCommunityIcons
              name={cameraOn ? 'camera' : 'camera-off'}
              size={22}
              color="#FFFFFF"
            />
            <Text style={styles.webrtcControlLabel}>{cameraOn ? 'Camera On' : 'Camera Off'}</Text>
          </Pressable>
        )}

        {callType === 'video' && cameraOn && (
          <Pressable
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            style={[styles.webrtcControlBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <MaterialCommunityIcons name="camera-flip" size={22} color="#FFFFFF" />
            <Text style={styles.webrtcControlLabel}>Flip Camera</Text>
          </Pressable>
        )}

        <Pressable onPress={handleEndCall} style={[styles.webrtcControlBtn, styles.webrtcEndCallBtn]}>
          <MaterialCommunityIcons name="phone-hangup" size={26} color="#FFFFFF" />
          <Text style={styles.webrtcControlLabel}>End Call</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  headerTitle: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.bold,
  },
  lobbyHeader: {
    marginBottom: Spacing.three,
  },
  lobbyTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  lobbySub: {
    fontSize: FontSize.caption,
    marginTop: 4,
  },
  lobbyPreviewBox: {
    height: 240,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  lobbyPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyPlaceholderText: {
    fontSize: FontSize.caption,
    marginTop: 8,
  },
  lobbyControlsCard: {
    marginBottom: Spacing.four,
    gap: Spacing.three,
  },
  lobbySettingsTitle: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  lobbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lobbyRowText: {
    flex: 1,
  },
  lobbyRowTitle: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.semibold,
  },
  lobbyRowSub: {
    fontSize: FontSize.caption - 1,
    marginTop: 2,
  },
  lobbyToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: 'auto',
  },
  ringingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  ringingName: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.four,
  },
  ringingSub: {
    fontSize: FontSize.caption,
    marginTop: Spacing.one,
  },
  ringingActions: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  hangupBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedCard: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.three,
  },
  endedIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  endedDesc: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  summaryBox: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: FontSize.caption,
  },
  summaryValue: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  endedBtn: {
    width: '100%',
    marginTop: Spacing.two,
  },

  /* ── DEV Debug Overlay ── */
  devDebugOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    padding: 6,
    zIndex: 9999,
  },
  devDebugText: {
    color: '#60A5FA',
    fontSize: 10,
    fontFamily: 'monospace',
  },

  /* ── WebRTC In-App P2P Viewport & Control Styles ── */
  webrtcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: 12,
    zIndex: 20,
  },
  webrtcHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webrtcHeaderName: {
    color: '#FFFFFF',
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  webrtcHeaderTimer: {
    color: '#94A3B8',
    fontSize: FontSize.caption,
    marginTop: 1,
  },
  webrtcHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  secureBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  webrtcCanvas: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  remoteVideoCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteParticipantCardOverlay: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  remoteParticipantName: {
    color: '#FFFFFF',
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  remoteParticipantRole: {
    color: '#94A3B8',
    fontSize: FontSize.caption,
  },
  remoteLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pipCameraOffBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOffPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoOffText: {
    color: '#FFFFFF',
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
  },
  videoOffSub: {
    color: '#94A3B8',
    fontSize: FontSize.caption,
  },
  webrtcVoiceContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  webrtcVoicePulseCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  webrtcVoiceName: {
    color: '#FFFFFF',
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.four,
  },
  webrtcVoiceSub: {
    color: '#94A3B8',
    fontSize: FontSize.caption,
    marginTop: Spacing.one,
  },
  floatingPipBox: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 108,
    height: 150,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 15,
  },
  pipLabelTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pipLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  webrtcControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: 16,
    backgroundColor: '#0B0F19',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  webrtcControlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    gap: 4,
  },
  webrtcControlLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  webrtcEndCallBtn: {
    backgroundColor: '#EF4444',
  },
});
