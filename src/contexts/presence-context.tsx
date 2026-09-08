import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';

interface PresenceContextValue {
  onlineUsers: string[];
  isUserOnline: (userId?: string | null) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUsers: [],
  isUserOnline: () => false,
});

interface PresenceProviderProps {
  userId: string;
  role?: string | null;
  anonymousId?: string | null;
  children: ReactNode;
}

export function PresenceProvider({ userId, role, anonymousId, children }: PresenceProviderProps) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const channelRef = useRef<any>(null);
  const isTrackingRef = useRef<boolean>(false);

  const getAliases = useCallback(() => {
    const list = [
      userId,
      anonymousId,
      role === 'counselor' ? 'kwame-boateng' : 'student-user',
    ].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [userId, role, anonymousId]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const channelName = 'online-presence';
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });
    channelRef.current = channel;

    const updatePresenceState = () => {
      try {
        const state = channel.presenceState();
        const uids: string[] = [];
        Object.values(state).forEach((presences: any) => {
          if (Array.isArray(presences)) {
            presences.forEach((p: any) => {
              if (p.userId) uids.push(p.userId);
              if (p.anonymousId) uids.push(p.anonymousId);
              if (Array.isArray(p.aliases)) {
                p.aliases.forEach((a: string) => {
                  if (a) uids.push(a);
                });
              }
            });
          }
        });
        setOnlineUsers(Array.from(new Set(uids.filter(Boolean))));
      } catch (e) {
        console.warn('[Presence] Error updating presence state:', e);
      }
    };

    const trackUserPresence = async () => {
      if (!channel) return;
      try {
        const aliases = getAliases();
        const trackPayload = {
          userId,
          role: role || (userId === 'kwame-boateng' ? 'counselor' : 'student'),
          anonymousId: anonymousId || null,
          aliases,
          online_at: new Date().toISOString(),
        };
        const res = await channel.track(trackPayload);
        if (res === 'ok') {
          isTrackingRef.current = true;
        }
      } catch (err) {
        console.warn('[Presence] track error:', err);
      }
    };

    channel
      .on('presence', { event: 'sync' }, updatePresenceState)
      .on('presence', { event: 'join' }, updatePresenceState)
      .on('presence', { event: 'leave' }, updatePresenceState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await trackUserPresence();
          updatePresenceState();
        }
      });

    // Periodic heartbeat to refresh presence registration
    const interval = setInterval(() => {
      if (channel) {
        trackUserPresence();
      }
    }, 25000);

    // AppState lifecycle: re-track on active, untrack on background
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        trackUserPresence();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        try {
          channel.untrack();
          isTrackingRef.current = false;
        } catch {}
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      try {
        channel.untrack();
      } catch {}
      supabase?.removeChannel(channel);
      channelRef.current = null;
      isTrackingRef.current = false;
    };
  }, [userId, role, anonymousId, getAliases]);

  const isUserOnline = useCallback(
    (id?: string | null) => {
      if (!id || typeof id !== 'string') return false;
      const clean = id.trim().toLowerCase();
      if (!clean) return false;

      // Match exact ID or case-insensitive or partial alias match
      return (
        onlineUsers.includes(id) ||
        onlineUsers.some((u) => {
          if (!u) return false;
          const uClean = u.toLowerCase();
          return uClean === clean || uClean.includes(clean) || clean.includes(uClean);
        })
      );
    },
    [onlineUsers]
  );

  return (
    <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
