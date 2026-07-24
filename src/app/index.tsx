import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useMockAuth } from '@/lib/mock-auth-store';
import { safeStorage } from '@/lib/safe-storage';

export default function Index() {
  const { isAuthenticated, role, approvalStatus } = useMockAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await safeStorage.getItem('counselcare_onboarding_completed');
        setShouldShowOnboarding(completed !== 'true');
      } catch (e) {
        console.warn('Error reading onboarding status:', e);
      } finally {
        setOnboardingChecked(true);
      }
    };

    if (isAuthenticated && role === 'student') {
      checkOnboarding();
    } else {
      setOnboardingChecked(true);
    }
  }, [isAuthenticated, role]);

  if (isAuthenticated === null || !onboardingChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#5B4FE5" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (role === 'counselor') {
    if (approvalStatus !== 'approved') {
      return <Redirect href="/counselor-pending" />;
    }
    return <Redirect href="/(counselor-tabs)" />;
  }

  if (shouldShowOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
