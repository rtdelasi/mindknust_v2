/** Derives a profile photo URL from a name or explicit avatar url. */
export const getCounselorPhoto = (counselorName: string, avatarUrl?: string) => {
  if (avatarUrl) return avatarUrl;
  const name = counselorName.toLowerCase();
  if (name.includes('victoria') || name.includes('adjei')) {
    return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300';
  }
  if (name.includes('joseph') || name.includes('asamoah')) {
    return 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300';
  }
  if (name.includes('nan') || name.includes('serwaa') || name.includes('selina') || name.includes('badu') || name.includes('amina')) {
    return 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300';
  }
  return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300'; // Default male
};

/**
 * Formats the display rating for a counselor.
 *
 * - `0` / `undefined` rating → the string "New" (no reviews yet).
 * - A rating with zero `review_count` is also treated as unrated even if the
 *   DB column default leaked through — the count is the authoritative signal.
 *
 * Returns an object so callers never forget to check both fields:
 *
 *   { display: '4.5', countPostfix: '(3)' }  — 3 reviews, avg 4.5
 *   { display: 'New', countPostfix: null   }  — unrated
 */
export const formatCounselorRating = (
  rating: number | undefined | null,
  reviewCount: number | undefined | null
): { display: string; countPostfix: string | null } => {
  const count = reviewCount ?? 0;
  const raw = rating ?? 0;

  if (count === 0 || raw === 0) {
    return { display: 'New', countPostfix: null };
  }

  return {
    display: raw.toFixed(1),
    countPostfix: `(${count})`,
  };
};

export interface CounselorFormats {
  online: boolean;
  inPerson: boolean;
}

/**
 * Parses a counselor's note field to check for format accommodations.
 * If note is prefixed with `[formats:...]`, extracts that metadata.
 * Otherwise, defaults to online only or online/in-person based on keywords.
 */
export function parseCounselorNote(note: string | null | undefined): {
  formats: CounselorFormats;
  cleanNote: string;
} {
  if (!note) {
    return {
      formats: { online: true, inPerson: false },
      cleanNote: '',
    };
  }

  const match = note.match(/^\[formats:([a-zA-Z0-9\-_,]+)\]\s*(.*)$/i);
  if (match) {
    const formatsStr = match[1] || '';
    const cleanNote = match[2] || '';
    return {
      formats: {
        online: formatsStr.includes('online'),
        inPerson: formatsStr.includes('in-person'),
      },
      cleanNote,
    };
  }

  // Fallback heuristic for mock/pre-existing data
  const lower = note.toLowerCase();
  const isOnline = lower.includes('online') || lower.includes('hybrid') || lower.includes('peer') || lower.includes('wellness') || lower.includes('support') || lower.includes('clinical');
  const isInPerson = lower.includes('hybrid') || lower.includes('in-person') || lower.includes('campus');

  return {
    formats: {
      online: isOnline || !isInPerson,
      inPerson: isInPerson,
    },
    cleanNote: note,
  };
}

/**
 * Serializes format preferences and raw note into a single string.
 */
export function serializeCounselorNote(formats: CounselorFormats, cleanNote: string): string {
  const formatList: string[] = [];
  if (formats.online) formatList.push('online');
  if (formats.inPerson) formatList.push('in-person');
  return `[formats:${formatList.join(',')}] ${cleanNote}`;
}

/**
 * Parses an appointment's topic field to extract the topic and choice of session format.
 */
export function parseAppointmentTopic(topic: string | null | undefined): {
  cleanTopic: string;
  sessionType: 'online' | 'in-person';
} {
  if (!topic) {
    return { cleanTopic: 'General Support', sessionType: 'online' };
  }
  const parts = topic.split(' | ');
  if (parts.length > 1) {
    const format = parts[1].trim().toLowerCase();
    return {
      cleanTopic: parts[0].trim(),
      sessionType: format === 'in-person' ? 'in-person' : 'online',
    };
  }
  return {
    cleanTopic: topic,
    sessionType: 'online',
  };
}

/**
 * Serializes topic and session format into a single string.
 */
export function serializeAppointmentTopic(topic: string, sessionType: 'online' | 'in-person'): string {
  return `${topic} | ${sessionType === 'in-person' ? 'In-person' : 'Online'}`;
}
