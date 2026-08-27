export const DEFAULT_SESSION_DURATION_MINUTES = 30;
export const JOIN_WINDOW_EARLY_MINUTES = 5;

export interface JoinWindowCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Parses date (YYYY-MM-DD) and time slot (e.g. "10:00 AM", "2:30 PM", or range "10:00 AM - 10:30 AM")
 * into Date objects using UTC timezone.
 */
export function parseAppointmentDateTime(dateStr: string, timeSlot: string): { start: Date; end: Date | null } {
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }
  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed
  const day = parseInt(dateMatch[3], 10);

  const parts = timeSlot.split('-');
  const startPart = parts[0].trim();
  const endPart = parts[1] ? parts[1].trim() : null;

  const startHourMin = parseTimeStr(startPart);
  const startMs = Date.UTC(year, month, day, startHourMin.hours, startHourMin.minutes, 0);
  const start = new Date(startMs);

  let end: Date | null = null;
  if (endPart) {
    try {
      const endHourMin = parseTimeStr(endPart);
      const endMs = Date.UTC(year, month, day, endHourMin.hours, endHourMin.minutes, 0);
      end = new Date(endMs);
      if (end.getTime() < start.getTime()) {
        // Handle overnight wrap-around
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
    } catch {
      // Ignore parsing errors for the end part and default to fallback duration
    }
  }

  return { start, end };
}

function parseTimeStr(timeStr: string): { hours: number; minutes: number } {
  const cleanTime = timeStr.toUpperCase().trim();
  
  // Match formats like "10:00 AM" or "2:30 PM"
  const ampmMatch = cleanTime.match(/^(\d+):(\d+)\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3];

    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
    return { hours, minutes };
  }

  // Match 24-hour formats like "09:00" or "14:30"
  const hhmmMatch = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const minutes = parseInt(hhmmMatch[2], 10);
    return { hours, minutes };
  }

  throw new Error(`Unsupported time format: ${timeStr}`);
}

/**
 * Checks if the current time falls within the allowed join window for the appointment.
 * The window opens 5 minutes before start_time and closes at end_time.
 */
export function canJoinScheduledSession(appointment: any): JoinWindowCheck {
  if (!appointment) {
    return { allowed: false, reason: 'No appointment record provided.' };
  }

  let start: Date;
  let end: Date | null = null;

  if (appointment.start_time) {
    start = new Date(appointment.start_time);
    if (isNaN(start.getTime())) {
      return { allowed: false, reason: 'Invalid appointment start time.' };
    }
    if (appointment.end_time) {
      end = new Date(appointment.end_time);
      if (isNaN(end.getTime())) {
        return { allowed: false, reason: 'Invalid appointment end time.' };
      }
    }
  } else {
    if (!appointment.appointment_date || !appointment.time_slot) {
      return { allowed: false, reason: 'Appointment date or time slot is missing.' };
    }

    try {
      const parsed = parseAppointmentDateTime(appointment.appointment_date, appointment.time_slot);
      start = parsed.start;
      end = parsed.end;
    } catch (err: any) {
      return { allowed: false, reason: err.message || 'Failed to parse appointment date and time.' };
    }
  }

  if (!end) {
    end = new Date(start.getTime() + DEFAULT_SESSION_DURATION_MINUTES * 60 * 1000);
  }

  const nowMs = Date.now();
  const startMs = start.getTime();
  const endMs = end.getTime();

  const joinWindowOpenMs = startMs - JOIN_WINDOW_EARLY_MINUTES * 60 * 1000;

  if (nowMs < joinWindowOpenMs) {
    // Format the start time relative to the device local timezone for user clarity
    const timeString = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      allowed: false,
      reason: `Your session starts at ${timeString}. You can join starting 5 minutes early.`
    };
  }

  if (nowMs > endMs) {
    return {
      allowed: false,
      reason: 'This session has ended.'
    };
  }

  return { allowed: true };
}
