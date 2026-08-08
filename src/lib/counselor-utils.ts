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
