import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={DefaultTheme}>
        <RootLayoutContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  const insets = useSafeAreaInsets();
  const [activeAlert, setActiveAlert] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!supabase) return;

    // Listen for new public notifications in real-time
    const channel = supabase
      .channel('app-announcements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as { title: string; body: string };
          if (newNotif && newNotif.title) {
            setActiveAlert({
              title: newNotif.title,
              body: newNotif.body,
            });
            // Auto dismiss alert after 8 seconds
            setTimeout(() => {
              setActiveAlert(null);
            }, 8000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="video-call" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="booking/[counselor]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>

      {/* Floating Announcement Banner */}
      {activeAlert && (
        <View style={[styles.alertBanner, { top: insets.top + 12 }]}>
          <View style={styles.alertIconWrapper}>
            <MaterialCommunityIcons name="bullhorn" size={20} color="#7B39FD" />
          </View>
          <View style={styles.alertTextWrapper}>
            <Text numberOfLines={1} style={styles.alertTitle}>
              {activeAlert.title}
            </Text>
            <Text numberOfLines={2} style={styles.alertBody}>
              {activeAlert.body}
            </Text>
          </View>
          <Pressable onPress={() => setActiveAlert(null)} style={styles.alertCloseButton}>
            <MaterialCommunityIcons name="close" size={18} color="#64748B" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  alertBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    // Premium Drop Shadow
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 9999,
  },
  alertIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(123, 57, 253, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextWrapper: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  alertBody: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  alertCloseButton: {
    padding: 4,
  },
});
