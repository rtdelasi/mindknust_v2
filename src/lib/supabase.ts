import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { configuredValue } from '@/lib/env';
import { safeStorage } from '@/lib/safe-storage';
import { auth } from '@/lib/firebase';

const supabaseUrl = configuredValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = configuredValue(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: safeStorage,
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        realtime: {
          params: {
            apikey: supabaseAnonKey,
            eventsPerSecond: 10,
          },
        },
      })
    : null;
