/**
 * Mood Taxonomy — single source of truth
 *
 * The journal emoji row, the AI prediction mapping and the history screen all
 * read from here so a mood can never exist in one place and not the other.
 *
 * Ordered from most distressed → most positive; the emoji row renders in this
 * order.
 */

export type MoodKey =
  | 'distressed'
  | 'angry'
  | 'down'
  | 'okay'
  | 'good'
  | 'great';

export interface Mood {
  key: MoodKey;
  emoji: string;
  label: string;
}

export const MOODS: Mood[] = [
  { key: 'distressed', emoji: '😟', label: 'Distressed' },
  { key: 'angry', emoji: '😠', label: 'Angry' },
  { key: 'down', emoji: '😔', label: 'Down' },
  { key: 'okay', emoji: '🙂', label: 'Okay' },
  { key: 'good', emoji: '😊', label: 'Good' },
  { key: 'great', emoji: '😁', label: 'Great' },
];

const BY_KEY = new Map<MoodKey, Mood>(MOODS.map((m) => [m.key, m]));
const BY_EMOJI = new Map<string, Mood>(MOODS.map((m) => [m.emoji, m]));

export function moodEmoji(key: MoodKey): string {
  return BY_KEY.get(key)?.emoji ?? '🙂';
}

export function moodLabel(emoji: string): string {
  return BY_EMOJI.get(emoji)?.label ?? 'Logged';
}

export function moodKeyFromEmoji(emoji: string): MoodKey | null {
  return BY_EMOJI.get(emoji)?.key ?? null;
}

/**
 * Maps a −1→1 sentiment score onto the mood scale.
 *
 * Calibrated for the HF sentiment model, whose output is a softmax confidence
 * and so clusters near the extremes (|score| > 0.8 is routine).
 *
 * Note this axis has no anger dimension — a purely valence-based score cannot
 * distinguish "furious" from "devastated". Anger is decided upstream (by the
 * HF emotion model, or by the anger lexicon in the offline fallback) and only
 * unresolved cases land here.
 */
export function scoreToMoodKey(score: number): MoodKey {
  if (score < -0.4) return 'distressed';
  if (score < -0.1) return 'down';
  if (score <= 0.1) return 'okay';
  if (score <= 0.5) return 'good';
  return 'great';
}

/**
 * Same mapping for the offline lexicon, whose smoothed score grows with the
 * weight of evidence instead of saturating (one sentiment word ≈ 0.25, two
 * ≈ 0.4, four ≈ 0.57). Reusing the HF boundaries here made 😁 unreachable and
 * put a two-word entry like "sad and lonely" in the most severe bucket.
 */
export function lexicalScoreToMoodKey(score: number): MoodKey {
  if (score <= -0.5) return 'distressed';
  if (score <= -0.15) return 'down';
  if (score < 0.15) return 'okay';
  if (score < 0.4) return 'good';
  return 'great';
}
