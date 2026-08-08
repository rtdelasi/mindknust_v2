import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, FontSize, FontWeight, Spacing, Timing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type WeekDatePickerProps = {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
};

function getWeekDays(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DayCell({ date, selected, disabled, today, theme, onPress }: {
  date: Date;
  selected: boolean;
  disabled: boolean;
  today: boolean;
  theme: any;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={() => !disabled && onPress()}
        onPressIn={() => {
          scale.value = withSpring(0.9, Timing.springSnappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, Timing.spring);
        }}
        style={[
          styles.dayCell,
          selected && {
            backgroundColor: theme.primary,
          },
          !selected && {
            backgroundColor: theme.surfaceSoft,
          },
          disabled && { opacity: 0.35 },
        ]}>
        <Text
          style={[
            styles.dayName,
            {
              color: selected ? theme.textInverse : theme.textSecondary,
            },
          ]}>
          {DAY_NAMES[date.getDay()]}
        </Text>
        <Text
          style={[
            styles.dayNumber,
            {
              color: selected ? theme.textInverse : theme.text,
            },
            today &&
              !selected && {
                color: theme.primary,
                fontWeight: FontWeight.bold,
              },
          ]}>
          {date.getDate()}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function WeekDatePicker({
  selectedDate,
  onDateSelect,
  minDate,
  maxDate,
}: WeekDatePickerProps) {
  const theme = useTheme();
  const weekDays = getWeekDays(selectedDate);

  const goToPrevWeek = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 7);
    if (!minDate || prev >= minDate) onDateSelect(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    if (!maxDate || next <= maxDate) onDateSelect(next);
  };

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const isDisabled = (date: Date) => {
    const target = startOfDay(date);
    if (minDate && target < startOfDay(minDate)) return true;
    if (maxDate && target > startOfDay(maxDate)) return true;
    return false;
  };

  const monthLabel = selectedDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <Pressable onPress={goToPrevWeek} style={styles.arrowBtn}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={theme.text}
          />
        </Pressable>
        <Text style={[styles.monthLabel, { color: theme.text }]}>
          {monthLabel}
        </Text>
        <Pressable onPress={goToNextWeek} style={styles.arrowBtn}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.text}
          />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.weekRow}>
          {weekDays.map((date) => (
            <DayCell
              key={date.toISOString()}
              date={date}
              selected={isSameDay(date, selectedDate)}
              disabled={isDisabled(date)}
              today={isSameDay(date, new Date())}
              theme={theme}
              onPress={() => onDateSelect(date)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    padding: Spacing.one,
  },
  monthLabel: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  weekRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dayCell: {
    width: 52,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  dayName: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayNumber: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
