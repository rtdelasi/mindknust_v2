import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { BottomTabBar } from '@/components/ui/bottom-tab-bar';

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

export default function CounselorTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="view-dashboard"
              inactiveName="view-dashboard-outline"
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
              activeName="calendar-clock"
              inactiveName="calendar-clock-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="calendar-month"
              inactiveName="calendar-month-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              activeName="account-circle"
              inactiveName="account-circle-outline"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
