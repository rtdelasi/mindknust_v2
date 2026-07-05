import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card } from '@/components/ui';
import { BorderRadius, FontSize, FontWeight, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { useMockAuth } from '@/lib/mock-auth-store';
import { fetchAppointments, SupabaseAppointment } from '@/lib/supabase-db';
import { getCounselorPhoto } from '../(tabs)/sessions';

interface RosterStudent {
  id: string;
  name: string;
  avatar_url?: string;
  lastSessionDate?: string;
  nextSessionDate?: string;
  totalSessions: number;
}

export default function StudentRosterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useMockAuth();

  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = auth?.currentUser?.uid || (role === 'counselor' ? 'kwame-boateng' : 'student-user');

  useEffect(() => {
    const loadRoster = async () => {
      try {
        const appts = await fetchAppointments(currentUserId, 'counselor');
        
        // Group appointments by unique students
        const studentMap: { [key: string]: { name: string; avatar_url?: string; appts: SupabaseAppointment[] } } = {};
        
        appts.forEach((a) => {
          if (a.student_id && a.student_profile) {
            const sid = a.student_id;
            if (!studentMap[sid]) {
              studentMap[sid] = {
                name: a.student_profile.name,
                avatar_url: a.student_profile.avatar_url,
                appts: [],
              };
            }
            studentMap[sid].appts.push(a);
          }
        });

        // Compute next and last dates
        const rosterData: RosterStudent[] = Object.keys(studentMap).map((sid) => {
          const student = studentMap[sid];
          const sorted = [...student.appts].sort(
            (x, y) => new Date(x.appointment_date).getTime() - new Date(y.appointment_date).getTime()
          );
          
          const completedAppts = sorted.filter((a) => a.status === 'completed');
          const upcomingAppts = sorted.filter((a) => a.status === 'accepted');

          const lastDate = completedAppts.length > 0 ? completedAppts[completedAppts.length - 1].appointment_date : undefined;
          const nextDate = upcomingAppts.length > 0 ? upcomingAppts[0].appointment_date : undefined;

          return {
            id: sid,
            name: student.name,
            avatar_url: student.avatar_url,
            lastSessionDate: lastDate,
            nextSessionDate: nextDate,
            totalSessions: completedAppts.length,
          };
        });

        setRoster(rosterData);
      } catch (e) {
        console.warn('Error loading student roster:', e);
      } finally {
        setLoading(false);
      }
    };

    loadRoster();
  }, [currentUserId]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={Size.iconXl} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Student Roster</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={roster}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 64 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const cPhoto = getCounselorPhoto(item.name, item.avatar_url);

            return (
              <Card variant="surface" padding="three" style={styles.rosterCard}>
                <View style={styles.row}>
                  <Avatar name={item.name} size="md" source={{ uri: cPhoto }} />
                  <View style={styles.studentMeta}>
                    <Text style={[styles.studentName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.sessionStat, { color: theme.textSecondary }]}>
                      Completed sessions: {item.totalSessions}
                    </Text>
                    <View style={styles.datesGrid}>
                      <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                        Last Check-In: {item.lastSessionDate || 'None recorded'}
                      </Text>
                      <Text style={[styles.dateText, { color: theme.primary, fontWeight: FontWeight.semibold }]}>
                        Next Session: {item.nextSessionDate || 'None scheduled'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={[styles.actions, { borderTopColor: theme.border }]}>
                  <Button
                    label="View History"
                    variant="secondary"
                    icon="history"
                    style={styles.actionBtn}
                    onPress={() =>
                      Alert.alert(
                        'Session History',
                        `Student ${item.name} has completed ${item.totalSessions} consultations total.`
                      )
                    }
                  />
                  <Button
                    label="Send Message"
                    variant="primary"
                    icon="message-outline"
                    style={styles.actionBtn}
                    onPress={() => router.push('/chats')}
                  />
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No students currently in your active roster.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  backBtn: {
    padding: 2,
  },
  headerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  rosterCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.04)',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  studentMeta: {
    flex: 1,
    gap: 3,
  },
  studentName: {
    fontSize: FontSize.body - 1,
    fontWeight: FontWeight.bold,
  },
  sessionStat: {
    fontSize: FontSize.caption,
  },
  datesGrid: {
    marginTop: 4,
    gap: 2,
  },
  dateText: {
    fontSize: FontSize.caption - 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.two + 2,
  },
  actionBtn: {
    height: 36,
    paddingHorizontal: Spacing.three,
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: FontSize.caption + 1,
  },
});
