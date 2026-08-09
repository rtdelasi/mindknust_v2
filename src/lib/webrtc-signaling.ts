import { supabase } from './supabase';

export interface WebRTCSignalingEvent {
  type: 'offer' | 'answer' | 'ice-candidate' | 'media-state' | 'hangup';
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
        // Ignore signals originating from self
        if (signal && signal.senderId !== this.userId && this.callback) {
          this.callback(signal);
        }
      })
      .subscribe((status: string) => {
        console.log(`[WebRTCSignaling] Channel ${channelName} status:`, status);
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
  public sendMediaState(state: { micOn: boolean; cameraOn: boolean; facing: 'front' | 'back'; trackId?: string }): void {
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
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: event,
      });
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
    this.callback = null;
  }
}
