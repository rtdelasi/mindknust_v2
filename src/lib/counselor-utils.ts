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
