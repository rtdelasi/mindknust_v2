import { supabase } from './supabase';

export interface WebRTCSignalingEvent {
  type: 'offer' | 'answer' | 'ice-candidate' | 'media-state' | 'hangup' | 'peer-ready';
  senderId: string;
  payload: any;
}

export type WebRTCSignalingCallback = (event: WebRTCSignalingEvent) => void;

/**
 * WebRTC Signaling Manager using Supabase Realtime Channels.
 * Handles peer-to-peer SDP Offer/Answer negotiation and ICE candidate exchange.
 */
export class WebRTCSignalingManager {
  private channel: any = null;
  private roomId: string;
  private userId: string;
  private callback: WebRTCSignalingCallback | null = null;
  private isSubscribed: boolean = false;
  private messageQueue: WebRTCSignalingEvent[] = [];

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  /**
   * Connect to the Supabase Realtime P2P Signaling Channel.
   */
  public connect(callback: WebRTCSignalingCallback): void {
    if (!supabase) return;
    this.callback = callback;

    const channelName = `webrtc-p2p-${this.roomId}`;
    this.channel = supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: 'webrtc_signal' }, (data: { payload: WebRTCSignalingEvent }) => {
        const signal = data.payload;
        if (signal) {
          console.log(`[${this.userId}] [WebRTCSignaling] Received signal [${signal.type}] from [${signal.senderId}]`);
        }
        // Ignore signals originating from self
        if (signal && signal.senderId !== this.userId && this.callback) {
          this.callback(signal);
        }
      })
      .subscribe((status: string) => {
        console.log(`[${this.userId}] [WebRTCSignaling] Channel ${channelName} status:`, status);
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.flushQueue();
          this.sendPeerReady();
        } else {
          this.isSubscribed = false;
        }
      });
  }

  /**
   * Broadcast peer ready signal indicating channel is active and listening over WebSockets.
   */
  public sendPeerReady(): void {
    this.sendSignal({
      type: 'peer-ready',
      senderId: this.userId,
      payload: {},
    });
  }

  /**
   * Send a WebRTC SDP Offer to the remote peer.
   */
  public sendOffer(sdp: any): void {
    this.sendSignal({
      type: 'offer',
      senderId: this.userId,
      payload: sdp,
    });
  }

  /**
   * Send a WebRTC SDP Answer to the remote peer.
   */
  public sendAnswer(sdp: any): void {
    this.sendSignal({
      type: 'answer',
      senderId: this.userId,
      payload: sdp,
    });
  }

  /**
   * Send an ICE Candidate to the remote peer.
   */
  public sendICECandidate(candidate: any): void {
    this.sendSignal({
      type: 'ice-candidate',
      senderId: this.userId,
      payload: candidate,
    });
  }

  /**
   * Broadcast media state changes (e.g. mic muted, camera off).
   */
  public sendMediaState(state: {
    micOn: boolean;
    cameraOn: boolean;
    facing: 'front' | 'back';
    videoTrackId?: string;
    audioTrackId?: string;
  }): void {
    this.sendSignal({
      type: 'media-state',
      senderId: this.userId,
      payload: state,
    });
  }

  /**
   * Broadcast hangup signal.
   */
  public sendHangup(): void {
    this.sendSignal({
      type: 'hangup',
      senderId: this.userId,
      payload: {},
    });
  }

  private sendSignal(event: WebRTCSignalingEvent): void {
    if (!this.channel) return;

    if (this.isSubscribed) {
      console.log(`[${this.userId}] [WebRTCSignaling] Sending signal [${event.type}] via WebSocket broadcast`);
      this.channel.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: event,
      });
    } else {
      console.log(`[${this.userId}] [WebRTCSignaling] Channel not SUBSCRIBED yet. Queueing signal [${event.type}]`);
      this.messageQueue.push(event);
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.channel && this.isSubscribed) {
      const event = this.messageQueue.shift();
      if (event) {
        console.log(`[${this.userId}] [WebRTCSignaling] Flushing queued signal [${event.type}] via WebSocket broadcast`);
        this.channel.send({
          type: 'broadcast',
          event: 'webrtc_signal',
          payload: event,
        });
      }
    }
  }

  /**
   * Disconnect and unsubscribe from the signaling channel.
   */
  public disconnect(): void {
    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.isSubscribed = false;
    this.messageQueue = [];
    this.callback = null;
  }
}
