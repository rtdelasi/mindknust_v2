export type ViewerRole = 'student' | 'counselor' | 'admin';

interface IdentityUser {
  name?: string;
  anonymous_id?: string;
}

export function getDisplayIdentity(
  user: IdentityUser | null | undefined,
  isAnonymous: boolean,
  viewerRole: ViewerRole
): string {
  if (viewerRole === 'counselor' || viewerRole === 'admin') {
    return user?.name || 'Unknown';
  }
  if (isAnonymous && user?.anonymous_id) {
    return user.anonymous_id;
  }
  return user?.name || 'Anonymous User';
}

export function getAuthorInitials(displayName: string): string {
  if (!displayName) return '??';
  const parts = displayName.split(/[\s_]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}

export function getHandleTag(displayName: string): string {
  return `@${displayName.toLowerCase().replace(/[\s_]+/g, '')}`;
}
