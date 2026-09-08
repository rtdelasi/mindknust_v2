import { supabase } from './supabase';

export interface WebRTCSignalingEvent {
  type: 'offer' | 'answer' | 'ice-candidate' | 'media-state' | 'hangup' | 'peer-ready' | 'error';
  senderId: string;
  payload: any;
}

export type WebRTCSignalingCallback = (event: WebRTCSignalingEvent) => void;

/**
 * WebRTC Signaling Manager using Supabase Realtime Channels.
 * Handles peer-to-peer SDP Offer/Answer negotiation and ICE candidate exchange
 * with bounded retries, message queueing, and acknowledgment.
 */
export class WebRTCSignalingManager {
  private channel: any = null;
  private roomId: string;
  private userId: string;
  private callback: WebRTCSignalingCallback | null = null;
  private isSubscribed: boolean = false;
  private isExplicitlyClosed: boolean = false;
  private messageQueue: WebRTCSignalingEvent[] = [];
  private retryTimeout: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

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
    this.isExplicitlyClosed = false;

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    const channelName = `webrtc-p2p-${this.roomId}`;
    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true, self: false },
      },
    });

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
          this.reconnectAttempts = 0;
          this.flushQueue();
          this.sendPeerReady();
        } else {
          this.isSubscribed = false;
          // Auto-reconnect with bounded retries if unexpectedly closed or timed out
          if (!this.isExplicitlyClosed && (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED')) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts += 1;
              const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
              console.log(`[${this.userId}] [WebRTCSignaling] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
              if (this.retryTimeout) clearTimeout(this.retryTimeout);
              this.retryTimeout = setTimeout(() => {
                if (!this.isExplicitlyClosed && this.callback) {
                  this.connect(this.callback);
                }
              }, delay);
            } else {
              console.warn(`[${this.userId}] [WebRTCSignaling] Max reconnection attempts (${this.maxReconnectAttempts}) reached.`);
              if (this.callback) {
                this.callback({
                  type: 'error',
                  senderId: 'system',
                  payload: {
                    message: 'Real-time call connection timed out. Please check your network connection.',
                  },
                });
              }
            }
          }
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
    if (!this.channel) {
      this.messageQueue.push(event);
      return;
    }

    if (this.isSubscribed) {
      console.log(`[${this.userId}] [WebRTCSignaling] Sending signal [${event.type}] via WebSocket broadcast`);
      this.channel
        .send({
          type: 'broadcast',
          event: 'webrtc_signal',
          payload: event,
        })
        .catch((err: any) => {
          console.warn(`[${this.userId}] [WebRTCSignaling] send error:`, err);
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
        this.channel
          .send({
            type: 'broadcast',
            event: 'webrtc_signal',
            payload: event,
          })
          .catch(() => {});
      }
    }
  }

  /**
   * Disconnect and unsubscribe from the signaling channel.
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.reconnectAttempts = 0;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.channel && supabase) {
      try {
        supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
    this.isSubscribed = false;
    this.messageQueue = [];
    this.callback = null;
  }
}
