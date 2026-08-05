import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useState, useEffect } from 'react';

import { FloatingTabBar } from '@/components/ui/floating-tab-bar';
import { useMockAuth } from '@/lib/mock-auth-store';
import { fetchPendingCounselorsCount } from '@/lib/supabase-db';
import { supabase } from '@/lib/supabase';

function TabIcon({
  focused,
  activeName,
  inactiveName,
  color,
}: {
  focused: boolean;
  activeName: keyof typeof MaterialCommunityIcons.glyphMap;
  inactiveName: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}) {
  return (
    <MaterialCommunityIcons
      name={focused ? activeName : inactiveName}
      size={24}
      color={color}
    />
  );
}

export default function TabLayout() {
  const { role } = useMockAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const loadPendingBadge = async () => {
      if (role === 'admin') {
        const cnt = await fetchPendingCounselorsCount();
        setPendingCount(cnt);
      }
    };

    loadPendingBadge();

    if (role === 'admin' && supabase) {
      const client = supabase;
      const channelName = `admin_badge_count-${Date.now()}`;
      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'counselor_profiles' },
          () => {
            loadPendingBadge();
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    }
  }, [role]);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="home"
              inactiveName="home-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="message-text"
              inactiveName="message-text-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="calendar"
              inactiveName="calendar-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          href: role === 'admin' ? '/(tabs)/approvals' : null,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="shield-check"
              inactiveName="shield-check-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="account"
              inactiveName="account-outline"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
