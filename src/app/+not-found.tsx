import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function NotFound() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>This page is not available.</Text>
      <Link href="/(tabs)" asChild>
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]}>
          <Text style={[styles.buttonText, { color: theme.textInverse }]}>Back to home</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.five,
  },
  title: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  button: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  buttonText: {
    fontWeight: FontWeight.bold,
  },
});
