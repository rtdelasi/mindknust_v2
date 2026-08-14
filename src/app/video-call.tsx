import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  MediaStream,
} from '@livekit/react-native-webrtc';

import {
  HMSSDK,
  HMSConfig,
  HMSUpdateListenerActions,
  HMSVideoViewMode,
} from '@100mslive/react-native-hms';
import { getHmsAuthToken } from '@/lib/hms-service';

const HMSConstants = {
  DEFAULT_SDK_ID: '12345',
};

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
  videoTrackId?: string;
  audioTrackId?: string;
  videoTrack?: { trackId: string };
  audioTrack?: { trackId: string };
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

  const localVideoTrackIdRef = useRef(`vtrack_${currentUserId}`);
  const localAudioTrackIdRef = useRef(`atrack_${currentUserId}`);
  const [stableTrackId, setStableTrackId] = useState<string | undefined>(undefined);
  const prevTrackIdRef = useRef<string | undefined>(undefined);

  const hmsInstanceRef = useRef<HMSSDK | null>(null);
  const [hmsInstance, setHmsInstance] = useState<HMSSDK | null>(null);
  const [hmsInstanceId, setHmsInstanceId] = useState<string | null>(null);
  const [remoteHmsTrackId, setRemoteHmsTrackId] = useState<string | undefined>(undefined);

  // Real WebRTC P2P MediaStream State & PeerConnection Ref
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueueRef = useRef<any[]>([]);

  // ── Remote Track Resolution (100ms HMS / WebRTC Integration) ──
  const hmsPeers: any[] = [];
  const remoteHmsPeer = hmsPeers?.find((p: any) => !p.isLocal);
  const localHmsPeer = hmsPeers?.find((p: any) => p.isLocal);

  // Log local peer's own video track state
  useEffect(() => {
    const localVideoTrackObj = localHmsPeer?.videoTrack;
    const isMuteVal =
      typeof localVideoTrackObj?.isMute === 'function'
        ? localVideoTrackObj.isMute()
        : localVideoTrackObj?.isMute;

    console.log('[VideoDebug] Local HMS Peer track state:', {
      localPeerId: localHmsPeer?.peerID,
      localVideoTrackId: localVideoTrackObj?.trackId,
      localVideoTrackIsMute: isMuteVal,
      isLocalVideoTrackPresent: Boolean(localVideoTrackObj),
    });
  }, [localHmsPeer?.peerID, localHmsPeer?.videoTrack]);

  // Enable remote video playback on HMS SDK remote video track if present
  useEffect(() => {
    if (remoteHmsPeer?.videoTrack?.setPlaybackAllowed) {
      try {
        console.log(
          '[VideoDebug] Calling setPlaybackAllowed(true) for remote track:',
          remoteHmsPeer.videoTrack.trackId
        );
        remoteHmsPeer.videoTrack.setPlaybackAllowed(true);
      } catch (err) {
        console.warn('[VideoDebug] setPlaybackAllowed error:', err);
      }
    }
  }, [remoteHmsPeer?.videoTrack]);

  // Log distinct audio vs video track IDs and remote video track isMute status
  useEffect(() => {
    const remoteVideoTrackObj = remoteHmsPeer?.videoTrack;
    const trackIsMute =
      typeof remoteVideoTrackObj?.isMute === 'function'
        ? remoteVideoTrackObj.isMute()
        : remoteVideoTrackObj?.isMute ?? (!peerState.cameraOn);

    console.log('[VideoDebug] peer track types & mute status:', {
      audioTrackId: remoteHmsPeer?.audioTrack?.trackId || peerState.audioTrackId || peerState.audioTrack?.trackId,
      videoTrackId: remoteHmsPeer?.videoTrack?.trackId || peerState.videoTrackId || peerState.videoTrack?.trackId,
      signalingVideoTrackId: peerState.videoTrackId,
      remoteVideoTrackIsMute: trackIsMute,
    });
  }, [
    remoteHmsPeer?.audioTrack?.trackId,
    remoteHmsPeer?.videoTrack?.trackId,
    remoteHmsPeer?.videoTrack,
    peerState.audioTrackId,
    peerState.videoTrackId,
    peerState.audioTrack?.trackId,
    peerState.videoTrack?.trackId,
    peerState.cameraOn,
  ]);

  // Strictly derive candidate track ID from explicit video-typed sources ONLY (no generic trackId fallback)
  const candidateTrackId =
    remoteHmsPeer?.videoTrack?.trackId ||
    peerState.videoTrackId ||
    peerState.videoTrack?.trackId;

  useEffect(() => {
    if (!peerState.cameraOn) {
      if (stableTrackId !== undefined) {
        setStableTrackId(undefined);
      }
    } else if (candidateTrackId && candidateTrackId !== stableTrackId) {
      setStableTrackId(candidateTrackId);
    }
  }, [candidateTrackId, peerState.cameraOn, stableTrackId]);

  // Log ONLY when video trackId genuinely changes
  useEffect(() => {
    if (stableTrackId !== prevTrackIdRef.current) {
      console.log('[VideoDebug] trackId CHANGED from', prevTrackIdRef.current, 'to', stableTrackId);
      prevTrackIdRef.current = stableTrackId;
    }
  }, [stableTrackId]);

  const defaultRoomId = useRef(
    `counselcare-webrtc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ).current;

  const activeRoomId = passedRoomId || defaultRoomId;
  const callIdRef = useRef<string | null>(passedCallId || null);
  const signalingRef = useRef<WebRTCSignalingManager | null>(null);
  const statusUnsubRef = useRef<(() => void) | null>(null);

  // ── Native 100ms WebRTC Engine Lifecycle (HMSSDK.build + join) ──
  // NOTE: [100ms Engine] setupHmsSession logic kept intact for reference/future cleanup per requirements
  useEffect(() => {
    if (callState !== 'connected') return;

    let isMounted = true;
    let hmsInstance: HMSSDK | null = null;

    const setupHmsSession = async () => {
      try {
        console.log('[100ms Engine] Building HMSSDK instance...');
        hmsInstance = await HMSSDK.build();
        if (!isMounted) return;

        hmsInstanceRef.current = hmsInstance;
        setHmsInstance(hmsInstance);
        setHmsInstanceId(hmsInstance.id);
        console.log('[100ms Engine] Built instance ID:', hmsInstance.id);

        // 1. Listen for room join event
        hmsInstance.addEventListener(HMSUpdateListenerActions.ON_JOIN, (data: any) => {
          console.log('[100ms Engine] ON_JOIN: Joined 100ms room:', data?.room?.name);
        });

        // 2. Listen for peer updates
        hmsInstance.addEventListener(HMSUpdateListenerActions.ON_PEER_UPDATE, (data: any) => {
          console.log('[100ms Engine] ON_PEER_UPDATE:', data?.type, data?.peer?.name);
        });

        // 3. Listen for track updates (remote video publishing)
        hmsInstance.addEventListener(HMSUpdateListenerActions.ON_TRACK_UPDATE, (data: any) => {
          console.log(
            '[100ms Engine] ON_TRACK_UPDATE:',
            data?.track?.trackId,
            data?.track?.type,
            data?.peer?.name
          );
          if (data?.track?.type === 'VIDEO' && !data?.peer?.isLocal) {
            console.log('[100ms Engine] Remote video track published:', data.track.trackId);
            setRemoteHmsTrackId(data.track.trackId);
            if (data.track.setPlaybackAllowed) {
              try {
                data.track.setPlaybackAllowed(true);
              } catch (_err) {}
            }
          }
        });

        // 4. Listen for errors
        hmsInstance.addEventListener(HMSUpdateListenerActions.ON_ERROR, (error: any) => {
          console.error('[100ms Engine] ON_ERROR:', error);
        });

        // Fetch Auth Token & Join 100ms Room
        const authToken = await getHmsAuthToken(hmsInstance, activeRoomId, currentUserId);
        const config = new HMSConfig({ authToken, username: localPeerName });
        console.log('[100ms Engine] Joining room with config username:', localPeerName);
        await hmsInstance.join(config);
        console.log('[100ms Engine] Join call completed');
      } catch (err) {
        console.warn('[100ms Engine] Initialization error:', err);
      }
    };

    setupHmsSession();

    return () => {
      isMounted = false;
      if (hmsInstance) {
        console.log('[100ms Engine] Leaving 100ms room & destroying instance...');
        hmsInstance.leave().catch(() => {});
        hmsInstanceRef.current = null;
        setHmsInstance(null);
      }
    };
  }, [callState, activeRoomId, currentUserId, localPeerName]);

  // Sync local controls (mic, camera, facing) directly to 100ms native engine
  useEffect(() => {
    if (!hmsInstanceRef.current) return;
    const syncControls = async () => {
      try {
        const localPeer = await hmsInstanceRef.current?.getLocalPeer();
        const vTrack: any = localPeer?.localVideoTrack ? localPeer.localVideoTrack() : (localPeer as any)?.videoTrack;
        const aTrack: any = localPeer?.localAudioTrack ? localPeer.localAudioTrack() : (localPeer as any)?.audioTrack;

        if (vTrack && typeof vTrack.setMute === 'function') {
          vTrack.setMute(!cameraOn);
        }
        if (aTrack && typeof aTrack.setMute === 'function') {
          aTrack.setMute(!micOn);
        }
      } catch (_err) {}
    };
    syncControls();
  }, [cameraOn, micOn]);

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

  // Helper to flush buffered ICE candidates once remoteDescription is set
  const flushIceCandidateQueue = useCallback(async (pc: RTCPeerConnection) => {
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      try {
        console.log(`[${localPeerName}] [WebRTC P2P] Flushing queued ICE candidate`);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`[${localPeerName}] [WebRTC P2P] Error adding queued ICE candidate:`, err);
      }
    }
  }, [localPeerName]);

  // WebRTC P2P PeerConnection Builder
  const getOrCreatePeerConnection = useCallback(async () => {
    if (pcRef.current) return pcRef.current;

    console.log(`[${localPeerName}] [WebRTC P2P] Initializing RTCPeerConnection...`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.ontrack = (event: any) => {
      console.log(`[${localPeerName}] [WebRTC P2P] Received remote track:`, event.streams);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else if (event.track) {
        const newStream = new MediaStream([event.track]);
        setRemoteStream(newStream);
      }
    };

    pc.onicecandidate = (event: any) => {
      if (event.candidate && signalingRef.current) {
        const candJson = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
        console.log(`[${localPeerName}] [WebRTC P2P] Discovered and sending ICE candidate payload:`, candJson);
        signalingRef.current.sendICECandidate(candJson);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[${localPeerName}] [WebRTC P2P] ICE connection state changed:`, pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[${localPeerName}] [WebRTC P2P] Peer connection state changed:`, pc.connectionState);
    };

    try {
      const capturedLocalStream = await mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      setLocalStream(capturedLocalStream);
      capturedLocalStream.getTracks().forEach((track) => {
        pc.addTrack(track, capturedLocalStream);
      });
    } catch (err) {
      console.warn(`[${localPeerName}] [WebRTC P2P] getUserMedia warning (hardware/permissions):`, err);
    }

    pcRef.current = pc;
    return pc;
  }, [callType, localPeerName]);

  // Deterministic Caller vs Callee Role Selection:
  // - If accepting an incoming call overlay, local user is strictly Callee (isCaller = false).
  // - Otherwise, if student calling counselor, or tie-break using currentUserId comparison, local user is Caller (isCaller = true).
  const targetRemoteId = counselorId || passedRoomId || '';
  const isCaller = useMemo(() => {
    if (isIncomingAccepted === 'true') return false;
    if (role === 'student') return true;
    if (!targetRemoteId) return true;
    return currentUserId.localeCompare(targetRemoteId) < 0;
  }, [isIncomingAccepted, role, currentUserId, targetRemoteId]);

  const callInitiated = useRef(false);
  const offerSentRef = useRef(false);

  // Helper to generate and send SDP Offer once peer-ready signal is received
  const sendOfferToPeer = useCallback(async () => {
    if (offerSentRef.current) return;
    offerSentRef.current = true;
    console.log(`[${localPeerName}] Received ready signal from callee, now sending offer.`);
    try {
      const pc = await getOrCreatePeerConnection();
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await pc.setLocalDescription(offer);
      if (pc.localDescription && signalingRef.current) {
        const descJson = pc.localDescription.toJSON
          ? pc.localDescription.toJSON()
          : { sdp: pc.localDescription.sdp, type: pc.localDescription.type };
        console.log(`[${localPeerName}] [WebRTC P2P] Broadcasting SDP Offer payload over WebSocket:`, descJson);
        signalingRef.current.sendOffer(descJson);
      }
    } catch (offerErr) {
      console.warn(`[${localPeerName}] [WebRTC P2P] Error creating P2P offer:`, offerErr);
      offerSentRef.current = false;
    }
  }, [getOrCreatePeerConnection, callType, localPeerName]);

  // 5. WebRTC P2P Signaling Engine Setup
  useEffect(() => {
    if (!activeRoomId || !currentUserId) return;

    const signaling = new WebRTCSignalingManager(activeRoomId, currentUserId);
    signalingRef.current = signaling;

    signaling.connect(async (event: WebRTCSignalingEvent) => {
      console.log(`[${localPeerName}] [WebRTC Engine] Received signaling event:`, event.type);
      if (event.type === 'offer') {
        try {
          console.log(`[${localPeerName}] [WebRTC P2P] Received SDP Offer payload round-trip:`, JSON.stringify(event.payload));
          const pc = await getOrCreatePeerConnection();

          // Perfect Negotiation: check offer collision / glare
          const offerCollision = pc.signalingState !== 'stable';
          const isPolite = currentUserId.localeCompare(event.senderId || '') > 0;

          if (offerCollision) {
            if (!isPolite) {
              console.log(`[${localPeerName}] [WebRTC P2P] Glare detected on impolite peer: ignoring incoming offer`);
              return;
            }
            console.log(`[${localPeerName}] [WebRTC P2P] Glare detected on polite peer: rolling back local description`);
            await pc.setLocalDescription({ type: 'rollback', sdp: '' } as any);
          }

          await pc.setRemoteDescription(new RTCSessionDescription(event.payload));
          await flushIceCandidateQueue(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (pc.localDescription) {
            const descJson = pc.localDescription.toJSON
              ? pc.localDescription.toJSON()
              : { sdp: pc.localDescription.sdp, type: pc.localDescription.type };
            console.log(`[${localPeerName}] [WebRTC P2P] Sending SDP Answer payload over Supabase Realtime:`, descJson);
            signaling.sendAnswer(descJson);
          }
          setCallState('connected');
        } catch (err) {
          console.warn(`[${localPeerName}] [WebRTC P2P] Error handling SDP offer:`, err);
        }
      } else if (event.type === 'answer') {
        try {
          console.log(`[${localPeerName}] [WebRTC P2P] Received SDP Answer payload round-trip:`, JSON.stringify(event.payload));
          if (pcRef.current && event.payload) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(event.payload));
            await flushIceCandidateQueue(pcRef.current);
          }
          setCallState('connected');
        } catch (err) {
          console.warn(`[${localPeerName}] [WebRTC P2P] Error handling SDP answer:`, err);
        }
      } else if (event.type === 'ice-candidate') {
        if (event.payload) {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(event.payload));
            } catch (iceErr) {
              console.warn(`[${localPeerName}] [WebRTC P2P] addIceCandidate error:`, iceErr);
            }
          } else {
            console.log(`[${localPeerName}] [WebRTC P2P] Queuing ICE candidate (remoteDescription not set yet)`);
            iceCandidateQueueRef.current.push(event.payload);
          }
        }
      } else if (event.type === 'peer-ready') {
        console.log(`[${localPeerName}] Received peer-ready signal from [${event.senderId}]`);
        if (isCaller) {
          sendOfferToPeer();
        }
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
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setRemoteStream(null);
      setLocalStream(null);
      iceCandidateQueueRef.current = [];
      offerSentRef.current = false;
    };
  }, [activeRoomId, currentUserId, getOrCreatePeerConnection, flushIceCandidateQueue, isCaller, sendOfferToPeer, localPeerName]);

  // Broadcast local media state changes to remote peer
  useEffect(() => {
    if (callState === 'connected' && signalingRef.current) {
      signalingRef.current.sendMediaState({
        micOn,
        cameraOn,
        facing,
        videoTrackId: localVideoTrackIdRef.current,
        audioTrackId: localAudioTrackIdRef.current,
      });
    }
  }, [micOn, cameraOn, facing, callState]);

  // 6. Create call in DB + subscribe to status changes (CALLER ONLY)
  useEffect(() => {
    if (callState !== 'ringing' || !isCaller || !supabase || !counselorId || callInitiated.current) return;
    callInitiated.current = true;

    const startCall = async () => {
      console.log(`[${localPeerName}] [VideoCall] Creating call in DB...`);
      const call = await createCall(currentUserId, counselorId, callType as 'voice' | 'video', activeRoomId);
      if (!call) {
        console.warn(`[${localPeerName}] [VideoCall] Failed to create call in DB`);
        setCallState('idle');
        callInitiated.current = false;
        return;
      }
      callIdRef.current = call.id;

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
  }, [callState, counselorId, currentUserId, callType, activeRoomId, isCaller, localPeerName]);

  // 7. Handshake Timeout Monitor (12s limit for peer-ready signal)
  useEffect(() => {
    if (isCaller && (callState === 'ringing' || callState === 'connected') && !offerSentRef.current) {
      const handshakeTimeout = setTimeout(() => {
        if (!offerSentRef.current) {
          console.warn(`[${localPeerName}] Handshake timeout: No peer-ready signal received after 12s. Callee app may not be connected yet.`);
        }
      }, 12000);
      return () => clearTimeout(handshakeTimeout);
    }
  }, [isCaller, callState, localPeerName]);

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
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    iceCandidateQueueRef.current = [];
    setCallState('ended');
  }, [localStream]);

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
        {(() => {
          console.log(`[${localPeerName}] [VideoDebug] Remote media stream state:`, {
            callType,
            peerStateCameraOn: peerState.cameraOn,
            hasRemoteStream: Boolean(remoteStream),
            remoteStreamId: remoteStream?.id,
            activeVideoTracks: remoteStream?.getVideoTracks().length ?? 0,
            activeAudioTracks: remoteStream?.getAudioTracks().length ?? 0,
          });
          return null;
        })()}
        {callType === 'video' ? (
          peerState.cameraOn && remoteStream ? (
            <View
              style={styles.remoteVideoCanvas}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                console.log('[VideoDebug] remoteVideoCanvas layout dimensions:', { width, height });
              }}>
              <RTCView
                streamURL={remoteStream.toURL()}
                style={StyleSheet.absoluteFillObject}
                objectFit="cover"
                mirror={false}
                zOrder={0}
              />
            </View>
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
            {cameraOn && localStream ? (
              <RTCView
                streamURL={localStream.toURL()}
                style={StyleSheet.absoluteFillObject}
                objectFit="cover"
                mirror={facing === 'front'}
                zOrder={1}
              />
            ) : (
              <View style={styles.pipCameraOffBox}>
                <MaterialCommunityIcons name={cameraOn ? 'camera' : 'camera-off'} size={24} color="#94A3B8" />
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
