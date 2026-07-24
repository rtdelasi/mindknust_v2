import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { BottomTabBar } from '@/components/ui/bottom-tab-bar';
import { useMockAuth } from '@/lib/mock-auth-store';

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
  const { approvalStatus, role } = useMockAuth();

  if (role === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#5B4FE5" />
      </View>
    );
  }

  if (role === 'counselor' && approvalStatus !== 'approved') {
    return <Redirect href="/counselor-pending" />;
  }

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
