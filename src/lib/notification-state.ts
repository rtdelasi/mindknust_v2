import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-user read/dismissed tracking for notifications.
 *
 * The `notifications` table has a single `is_read` boolean and a nullable
 * `user_id`. A row with `user_id: null` is an app-wide broadcast shared by every
 * user, so writing `is_read: true` to it marks it read for *everyone* and
 * deleting it removes it for everyone. Only rows addressed to a specific user
 * can safely be mutated on the server.
 *
 * Everything else is tracked locally, per user id, so signing in as somebody
 * else on the same device does not inherit their read state.
 */

const READ_PREFIX = 'counselcare_read_notification_ids';
const DISMISSED_PREFIX = 'counselcare_dismissed_notification_ids';

/**
 * The original, un-scoped key. Read once and folded into the per-user key so
 * upgrading users do not see every announcement they had already read pop back
 * up as unread.
 */
const LEGACY_READ_KEY = READ_PREFIX;

const readKey = (userId: string) => `${READ_PREFIX}:${userId}`;
const dismissedKey = (userId: string) => `${DISMISSED_PREFIX}:${userId}`;

export interface NotificationRecord {
  id: string;
  user_id?: string | null;
  is_read?: boolean;
}

/** True when the row is an app-wide broadcast rather than a personal notice. */
export function isBroadcast(n: Pick<NotificationRecord, 'user_id'>): boolean {
  return !n.user_id;
}

async function loadIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    // Corrupt or non-JSON payload: treat as empty rather than crashing the screen.
    return [];
  }
}

async function saveIds(key: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify([...new Set(ids)]));
  } catch (err) {
    console.warn('[notifications] could not persist local state:', err);
  }
}

export async function getReadIds(userId: string): Promise<string[]> {
  const [scoped, legacy] = await Promise.all([
    loadIds(readKey(userId)),
    loadIds(LEGACY_READ_KEY),
  ]);
  return [...new Set([...scoped, ...legacy])];
}

export async function addReadIds(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const existing = await getReadIds(userId);
  await saveIds(readKey(userId), [...existing, ...ids]);
}

export async function removeReadId(userId: string, id: string): Promise<void> {
  const existing = await getReadIds(userId);
  await saveIds(
    readKey(userId),
    existing.filter((v) => v !== id)
  );
  // The legacy key is merged on every read, so a stale entry there would make
  // "mark as unread" appear to do nothing after a reload.
  const legacy = await loadIds(LEGACY_READ_KEY);
  if (legacy.includes(id)) {
    await saveIds(
      LEGACY_READ_KEY,
      legacy.filter((v) => v !== id)
    );
  }
}

export async function getDismissedIds(userId: string): Promise<string[]> {
  return loadIds(dismissedKey(userId));
}

export async function addDismissedIds(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const existing = await getDismissedIds(userId);
  await saveIds(dismissedKey(userId), [...existing, ...ids]);
}

/**
 * Folds local state into freshly-fetched rows: drops anything the user has
 * dismissed and marks anything they have read.
 */
export async function applyLocalState<T extends NotificationRecord>(
  rows: T[],
  userId: string
): Promise<T[]> {
  const [readIds, dismissedIds] = await Promise.all([
    getReadIds(userId),
    getDismissedIds(userId),
  ]);
  const read = new Set(readIds);
  const dismissed = new Set(dismissedIds);

  return rows
    .filter((row) => !dismissed.has(row.id))
    .map((row) => ({ ...row, is_read: Boolean(row.is_read) || read.has(row.id) }));
}

/**
 * Unread total for the bell badge. Counts the same way the list renders, so the
 * badge can never disagree with what the user actually sees.
 */
export async function countUnread(rows: NotificationRecord[], userId: string): Promise<number> {
  const visible = await applyLocalState(rows, userId);
  return visible.filter((row) => !row.is_read).length;
}
