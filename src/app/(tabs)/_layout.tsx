import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { BottomTabBar } from '@/components/ui';

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
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
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
