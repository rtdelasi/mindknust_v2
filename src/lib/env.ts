/**
 * Guards against `.env.example` being copied to `.env` without substituting
 * real credentials. The placeholder strings are non-empty, so a plain
 * truthiness check passes and the app builds a live client pointed at a
 * hostname that does not resolve — every request then hangs for the full DNS
 * timeout before failing. Treating placeholders as "absent" lets the existing
 * `if (!supabase) return` guards short-circuit instead.
 */
/**
 * The exact template values shipped in `.env.example`, matched whole rather
 * than by substring. A substring test is unsafe here: the Supabase anon key is
 * a base64url JWT whose alphabet includes `-` and `_`, so a real key can
 * contain something like `your_` by chance and would be silently discarded.
 */
const PLACEHOLDERS = new Set([
  'your-project-id.supabase.co',
  'https://your-project-id.supabase.co',
  'your_supabase_anon_key_here',
  'your_firebase_api_key_here',
  'your-project.firebaseapp.com',
  'your-firebase-project-id',
  'your-project.appspot.com',
  'your_messaging_sender_id_here',
  'your_firebase_app_id_here',
  'your_hf_api_key_here',
  '1:your_sender_id:web:your_app_id',
]);

export function configuredValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDERS.has(trimmed)) return undefined;
  // Catches the generic `<something>_here` / `your_<something>` shapes the
  // example file uses, anchored so a stray match inside a real key is
  // impossible.
  if (/^your[-_].*$/i.test(trimmed) || /^.*_here$/i.test(trimmed)) return undefined;
  return trimmed;
}
