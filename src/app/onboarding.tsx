import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { safeStorage } from '@/lib/safe-storage';

// Preferences list
const SUPPORT_AREAS = [
  { id: 'academic', label: 'Academic Stress', icon: 'book-open-page-variant-outline' },
  { id: 'anxiety', label: 'Anxiety & Focus', icon: 'brain' },
  { id: 'relationships', label: 'Relationship Advice', icon: 'account-group-outline' },
  { id: 'growth', label: 'Personal Growth', icon: 'sprout-outline' },
] as const;

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);

  const handleTogglePreference = (id: string) => {
    setSelectedPreferences((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      // Persist onboarding preferences locally and flag completion status
      await safeStorage.setItem('counselcare_student_preferences', JSON.stringify(selectedPreferences));
      await safeStorage.setItem('counselcare_onboarding_completed', 'true');
      router.replace('/');
    } catch (e) {
      console.warn('Failed to save onboarding settings:', e);
      router.replace('/');
    }
  };

  // Onboarding screens configuration
  const steps = [
    {
      title: 'Welcome to CounselCare',
      subtitle: 'Your safe, confidential campus space for mental health support and counseling guidance at KNUST.',
      icon: 'heart-pulse',
      color: theme.primary,
    },
    {
      title: 'Expert Support, Instantly',
      subtitle: 'Browse professional counselors, book hybrid consultations, and access voice or video call sessions directly inside the app.',
      icon: 'video-outline',
      color: '#0284C7',
    },
    {
      title: 'Track Your Wellbeing',
      subtitle: 'Log your feelings daily in your private journal. Notice emotional trends and build custom plans to maintain your inner balance.',
      icon: 'notebook-edit-outline',
      color: '#059669',
    },
    {
      title: 'Customize Your Care',
      subtitle: 'Select any key focus areas you would like support with so we can personalize your experience.',
      icon: 'tune-variant',
      color: '#D97706',
    },
    {
      title: "You're All Set!",
      subtitle: 'Your counselor network and self-reflection metrics are ready. Tap below to start your mental wellness journey.',
      icon: 'check-decagram-outline',
      color: theme.primary,
    },
  ];

  const step = steps[currentStep];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top skip layout */}
      <View style={styles.topBar}>
        <Text style={[styles.stepCount, { color: theme.textSecondary }]}>
          Step {currentStep + 1} of 5
        </Text>
        {currentStep < 4 && (
          <Pressable onPress={handleComplete}>
            <Text style={[styles.skipText, { color: theme.primary }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.content}>
        {/* Step Icon */}
        <View style={[styles.iconContainer, { backgroundColor: theme.surfaceRaised }]}>
          <MaterialCommunityIcons name={step.icon as any} size={72} color={step.color} />
        </View>

        {/* Dynamic Titles */}
        <Text style={[styles.title, { color: theme.text }]}>{step.title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{step.subtitle}</Text>

        {/* Step 4: Preferences Selector */}
        {currentStep === 3 && (
          <View style={styles.preferencesGrid}>
            {SUPPORT_AREAS.map((pref) => {
              const isSelected = selectedPreferences.includes(pref.id);
              return (
                <Pressable
                  key={pref.id}
                  onPress={() => handleTogglePreference(pref.id)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border, backgroundColor: theme.surfaceRaised },
                    isSelected && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
                  ]}>
                  <MaterialCommunityIcons
                    name={pref.icon as any}
                    size={18}
                    color={isSelected ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.chipLabel, { color: theme.textSecondary }, isSelected && { color: theme.primary, fontWeight: FontWeight.semibold }]}>
                    {pref.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Footer Navigation section */}
      <View style={styles.footer}>
        {/* Navigation Dot Indicators */}
        <View style={styles.dotContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: theme.border },
                currentStep === index && [styles.dotActive, { backgroundColor: theme.primary }],
              ]}
            />
          ))}
        </View>

        {/* Dynamic CTA button */}
        <Button
          label={currentStep === 4 ? 'Get Started' : 'Continue'}
          variant="primary"
          onPress={handleNext}
          style={styles.ctaButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  stepCount: {
    fontSize: FontSize.caption + 1,
    fontWeight: FontWeight.medium,
  },
  skipText: {
    fontSize: FontSize.body - 2,
    fontWeight: FontWeight.bold,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.four,
  },
  iconContainer: {
    width: 130,
    height: 130,
    borderRadius: BorderRadius.lg + 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(15, 23, 42, 0.05)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: FontSize.body - 1,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  preferencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: FontSize.caption + 1,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
  },
  ctaButton: {
    borderRadius: BorderRadius.full,
  },
});
