import { Platform } from 'react-native';
import { parseAppointmentDateTime } from './appointment-utils';

let Notifications: any = null;
try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications');
    // Set up the default notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (err) {
  console.warn('[NotificationService] expo-notifications native module not found. Push notifications will be disabled.', err);
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[NotificationService] Error requesting permissions:', err);
    return false;
  }
}

export async function scheduleSessionReminder(
  appointmentId: string,
  otherPartyName: string,
  appointmentDate: string,
  timeSlot: string
): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[NotificationService] Permission not granted. Skipping schedule.');
      return null;
    }

    // Cancel any existing notification for this appointment to avoid duplication
    await cancelSessionReminder(appointmentId);

    const { start } = parseAppointmentDateTime(appointmentDate, timeSlot);
    const startMs = start.getTime();
    const now = Date.now();
    const triggerTimeMs = startMs - 15 * 60 * 1000; // 15 mins before

    let seconds = Math.floor((triggerTimeMs - now) / 1000);
    if (seconds < 0) {
      const secondsToSession = Math.floor((startMs - now) / 1000);
      if (secondsToSession > 0) {
        seconds = 5; // Trigger in 5s if session starts in less than 15 mins but is in the future
      } else {
        console.log('[NotificationService] Session is in the past. Skipping notification schedule.');
        return null;
      }
    }

    const id = await Notifications.scheduleNotificationAsync({
      identifier: `session-reminder-${appointmentId}`,
      content: {
        title: 'Upcoming Session Reminder 🕒',
        body: `Your session with ${otherPartyName} starts in 15 minutes. Open MindKNUST to join the lobby!`,
        data: { appointmentId },
        sound: true,
      },
      trigger: {
        seconds,
      },
    });

    console.log(`[NotificationService] Scheduled reminder for appt ${appointmentId} in ${seconds}s (ID: ${id})`);
    return id;
  } catch (err) {
    console.warn('[NotificationService] Error scheduling notification:', err);
    return null;
  }
}

export async function cancelSessionReminder(appointmentId: string): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`session-reminder-${appointmentId}`);
    console.log(`[NotificationService] Cancelled reminder for appt ${appointmentId}`);
  } catch (err) {
    console.warn('[NotificationService] Error cancelling notification:', err);
  }
}
