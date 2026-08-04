import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * The exact template values shipped in `.env.example`, matched whole rather
 * than by substring. A substring test is unsafe here: the anon key is a
 * base64url JWT whose alphabet includes `-` and `_`, so a real key can contain
 * something like `your_` by chance and would be silently discarded.
 */
const PLACEHOLDERS = new Set([
  'https://your-project-id.supabase.co',
  'your-project-id.supabase.co',
  'your_supabase_anon_key_here',
]);

const isReal = (v: string | undefined) => {
  if (!v) return false;
  const t = v.trim();
  if (!t || PLACEHOLDERS.has(t)) return false;
  return !/^your[-_]/i.test(t) && !/_here$/i.test(t);
};

/**
 * True only when both Vite env vars are present and look like real values.
 * Without a `.env` file these are undefined, and every query silently fails
 * with "fetch failed" after a ~7s DNS timeout — so the UI must check this
 * before attempting to load, rather than spinning forever.
 */
export const hasSupabaseConfig = Boolean(
  isReal(rawUrl) && rawUrl.startsWith('http') && isReal(rawKey)
);

const supabaseUrl = hasSupabaseConfig ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = hasSupabaseConfig ? rawKey : 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
