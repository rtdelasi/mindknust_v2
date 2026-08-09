import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface PresenceContextValue {
  onlineUsers: string[];
  isUserOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUsers: [],
  isUserOnline: () => false,
});

export function PresenceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase.channel('online-presence');

    const updatePresenceState = () => {
      const state = channel.presenceState();
      const uids = Object.values(state)
        .flat()
        .flatMap((u: any) => [u.userId, ...(u.aliases || [])])
        .filter(Boolean);
      setOnlineUsers(Array.from(new Set(uids)));
    };

    const aliases = ['student-user', 'kwame-boateng'];

    channel
      .on('presence', { event: 'sync' }, updatePresenceState)
      .on('presence', { event: 'join' }, updatePresenceState)
      .on('presence', { event: 'leave' }, updatePresenceState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, aliases });
        }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [userId]);

  const isUserOnline = (id: string) => {
    if (!id) return false;
    return onlineUsers.includes(id) || onlineUsers.some((u) => u && (u.includes(id) || id.includes(u)));
  };

  return (
    <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
