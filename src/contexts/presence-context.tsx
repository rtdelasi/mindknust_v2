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
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const uids = Object.values(state).flat().map((u: any) => u.userId);
        setOnlineUsers(uids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId });
        }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [userId]);

  const isUserOnline = (id: string) => onlineUsers.includes(id);

  return (
    <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
