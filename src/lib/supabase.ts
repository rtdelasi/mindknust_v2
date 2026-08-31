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
          autoRefreshToken: false, // Managed by Firebase Auth
          persistSession: false,
          detectSessionInUrl: false,
        },
        accessToken: async () => {
          if (auth?.currentUser) {
            try {
              return await auth.currentUser.getIdToken();
            } catch {
              return null;
            }
          }
          return null;
        },
        global: {
          fetch: async (url, options = {}) => {
            if (auth?.currentUser) {
              try {
                const token = await auth.currentUser.getIdToken();
                if (token) {
                  const headers = new Headers(options.headers || {});
                  headers.set('Authorization', `Bearer ${token}`);
                  return fetch(url, { ...options, headers });
                }
              } catch (e) {
                console.warn('[Supabase Fetch Interceptor] Notice fetching token:', e);
              }
            }
            return fetch(url, options);
          },
        },
      })
    : null;
