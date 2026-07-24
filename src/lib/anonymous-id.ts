import { supabase, hasSupabaseConfig } from './supabase';

const ADJECTIVES = [
  'Quiet', 'Brave', 'Curious', 'Calm', 'Bright', 'Gentle', 'Bold', 'Silent',
  'Wise', 'Kind', 'Swift', 'Keen', 'Warm', 'Free', 'Wild', 'Noble',
  'Steady', 'Lucky', 'Jolly', 'Merry', 'Nimble', 'Sage', 'Cozy', 'Dreamy',
];

const ANIMALS = [
  'Otter', 'Falcon', 'Panda', 'Wolf', 'Sparrow', 'Fox', 'Owl', 'Heron',
  'Deer', 'Hare', 'Swan', 'Crane', 'Seal', 'Lynx', 'Bear', 'Wren',
  'Puma', 'Hawk', 'Lark', 'Ibis', 'Mink', 'Kite', 'Dove', 'Finch',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(): number {
  return Math.floor(Math.random() * 900) + 100; // 100-999
}

function generateCandidate(): string {
  return `${randomItem(ADJECTIVES)}${randomItem(ANIMALS)}_${randomDigits()}`;
}

export async function generateAnonymousId(): Promise<string> {
  if (!hasSupabaseConfig || !supabase) {
    return `${randomItem(ADJECTIVES)}${randomItem(ANIMALS)}_${randomDigits()}`;
  }

  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = generateCandidate();
    const { data, error } = await supabase
      .from('profiles')
      .select('anonymous_id')
      .eq('anonymous_id', candidate)
      .maybeSingle();

    if (error) {
      console.warn('anonymous_id uniqueness check failed, using candidate:', error);
      return candidate;
    }

    if (!data) {
      return candidate;
    }
  }

  return `${generateCandidate()}_${Date.now().toString(36)}`;
}

export async function claimAnonymousId(userId: string): Promise<string | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data: existing } = await supabase
    .from('profiles')
    .select('anonymous_id')
    .eq('id', userId)
    .maybeSingle();

  if (existing?.anonymous_id) {
    return existing.anonymous_id;
  }

  const anonymousId = await generateAnonymousId();
  const { error } = await supabase
    .from('profiles')
    .update({ anonymous_id: anonymousId })
    .eq('id', userId);

  if (error) {
    console.error('Failed to write anonymous_id:', error);
    return null;
  }

  return anonymousId;
}
