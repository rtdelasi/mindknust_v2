import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';

import { safeStorage } from '@/lib/safe-storage';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import { supabase, hasSupabaseConfig } from '@/lib/supabase';

const ROLE_KEY = 'counselcare_mock_role';
const AUTH_KEY = 'counselcare_mock_authenticated';
const USER_KEY = 'counselcare_mock_user_name';

export type UserRole = 'student' | 'counselor';

let listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

// Set up the listener on the Firebase auth state changed
if (hasFirebaseConfig && auth) {
  auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      // 1. Get the display name
      let name = firebaseUser.displayName || firebaseUser.email || 'User';

      // 2. Query user role from Supabase if connected
      let resolvedRole: UserRole = firebaseUser.email?.endsWith('@counselcare.edu') ? 'counselor' : 'student';
      if (hasSupabaseConfig && supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role, name')
            .eq('id', firebaseUser.uid)
            .maybeSingle();

          if (!error && data) {
            resolvedRole = data.role as UserRole;
            if (data.name) {
              name = data.name;
            }
          } else {
            // Fallback: check email domain or cached value
            const cached = await safeStorage.getItem(ROLE_KEY);
            if (cached === 'counselor' || cached === 'student') {
              resolvedRole = cached as UserRole;
            } else if (firebaseUser.email?.endsWith('@counselcare.edu')) {
              resolvedRole = 'counselor';
            }
          }
        } catch (e) {
          console.warn('Could not query role from Supabase, using fallbacks:', e);
        }
      } else {
        // Safe fallback in offline mode
        const cached = await safeStorage.getItem(ROLE_KEY);
        if (cached === 'counselor' || cached === 'student') {
          resolvedRole = cached as UserRole;
        } else if (firebaseUser.email?.endsWith('@counselcare.edu')) {
          resolvedRole = 'counselor';
        }
      }

      // 3. Cache them locally so they are synchronously fetchable
      await safeStorage.setItem(ROLE_KEY, resolvedRole);
      await safeStorage.setItem(AUTH_KEY, 'true');
      await safeStorage.setItem(USER_KEY, name);
    } else {
      // User is logged out, clear cache
      await safeStorage.removeItem(ROLE_KEY);
      await safeStorage.removeItem(AUTH_KEY);
      await safeStorage.removeItem(USER_KEY);
    }
    notifyListeners();
  });
}

export const mockAuth = {
  getRoleSync: (): UserRole | null => {
    return null;
  },
  getRole: async (): Promise<UserRole | null> => {
    return (await safeStorage.getItem(ROLE_KEY)) as UserRole | null;
  },
  isAuthenticated: async (): Promise<boolean> => {
    if (hasFirebaseConfig && auth) {
      return auth.currentUser !== null;
    }
    const localAuth = await safeStorage.getItem(AUTH_KEY);
    return localAuth === 'true';
  },
  getUserName: async (): Promise<string> => {
    if (hasFirebaseConfig && auth?.currentUser) {
      return (await safeStorage.getItem(USER_KEY)) || auth.currentUser.displayName || auth.currentUser.email || 'User';
    }
    return (await safeStorage.getItem(USER_KEY)) || 'Guest';
  },
  login: async (role: UserRole, email: string, name?: string) => {
    // If Firebase is active, we rely on register/login screens to sign in via Firebase,
    // which triggers onAuthStateChanged dynamically.
    // For mock testing, we write manually:
    const userName = name || (role === 'student' ? 'Adjoa D.' : 'Kwame Boateng');
    await safeStorage.setItem(ROLE_KEY, role);
    await safeStorage.setItem(AUTH_KEY, 'true');
    await safeStorage.setItem(USER_KEY, userName);
    notifyListeners();
  },
  updateProfileName: async (name: string) => {
    await safeStorage.setItem(USER_KEY, name);
    notifyListeners();
  },
  logout: async () => {
    if (hasFirebaseConfig && auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Firebase signOut error:', error);
      }
    }
    await safeStorage.removeItem(ROLE_KEY);
    await safeStorage.removeItem(AUTH_KEY);
    await safeStorage.removeItem(USER_KEY);
    notifyListeners();
  },
  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export function useMockAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    let active = true;
    async function load() {
      const isAuthed = await mockAuth.isAuthenticated();
      const userRole = await mockAuth.getRole();
      const name = await mockAuth.getUserName();
      if (active) {
        setIsAuthenticated(isAuthed);
        setRole(userRole);
        setUserName(name);
      }
    }

    load();

    const unsubscribe = mockAuth.subscribe(() => {
      load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { isAuthenticated, role, userName, login: mockAuth.login, logout: mockAuth.logout, updateProfileName: mockAuth.updateProfileName };
}
