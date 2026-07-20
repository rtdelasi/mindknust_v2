import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
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

  const isDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const monthLabel = selectedDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Month header with arrows */}
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

      {/* Week row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.weekRow}>
          {weekDays.map((date) => {
            const selected = isSameDay(date, selectedDate);
            const disabled = isDisabled(date);
            const today = isSameDay(date, new Date());
            return (
              <Pressable
                key={date.toISOString()}
                onPress={() => !disabled && onDateSelect(date)}
                style={[
                  styles.dayCell,
                  selected && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                  !selected && {
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceSoft,
                  },
                  disabled && { opacity: 0.4 },
                ]}>
                <Text
                  style={[
                    styles.dayName,
                    {
                      color: selected ? '#FFFFFF' : theme.textSecondary,
                    },
                  ]}>
                  {DAY_NAMES[date.getDay()]}
                </Text>
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: selected ? '#FFFFFF' : theme.text,
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
            );
          })}
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
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  dayName: {
    fontSize: FontSize.small - 1,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayNumber: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
