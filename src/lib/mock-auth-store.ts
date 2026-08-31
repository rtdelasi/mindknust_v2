import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';

import { safeStorage } from '@/lib/safe-storage';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import { supabase, hasSupabaseConfig } from '@/lib/supabase';
import { ensureAnonymousId } from '@/lib/supabase-db';

const ROLE_KEY = 'mindknust_mock_role';
const AUTH_KEY = 'mindknust_mock_authenticated';
const USER_KEY = 'mindknust_mock_user_name';
const AVATAR_KEY = 'mindknust_mock_avatar_url';
const ANON_ID_KEY = 'mindknust_mock_anonymous_id';
const APPROVAL_STATUS_KEY = 'mindknust_mock_approval_status';

export type UserRole = 'student' | 'counselor' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

let listeners: (() => void)[] = [];
let authResolved = !(hasFirebaseConfig && auth);

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

// Set up the listener on the Firebase auth state changed
if (hasFirebaseConfig && auth) {
  auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      let name = firebaseUser.displayName || firebaseUser.email || 'User';
      let avatar = firebaseUser.photoURL || null;
      let approvalStatus: ApprovalStatus = 'approved';
      let resolvedRole: UserRole = firebaseUser.email?.endsWith('@mindknust.edu.gh') ? 'counselor' : 'student';

      if (hasSupabaseConfig && supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('role, name, avatar_url, anonymous_id')
            .eq('id', firebaseUser.uid)
            .maybeSingle();

          if (!error && data) {
            resolvedRole = (data.role as UserRole) || resolvedRole;
            if (data.name) name = data.name;
            if (data.avatar_url) avatar = data.avatar_url;
            if (data.anonymous_id) {
              await safeStorage.setItem(ANON_ID_KEY, data.anonymous_id);
            } else if (resolvedRole === 'student') {
              const backfilled = await ensureAnonymousId(firebaseUser.uid);
              if (backfilled) {
                await safeStorage.setItem(ANON_ID_KEY, backfilled);
              }
            }
          }

          if (resolvedRole === 'counselor') {
            const { data: cData } = await supabase
              .from('counselor_profiles')
              .select('approval_status')
              .eq('user_id', firebaseUser.uid)
              .maybeSingle();

            if (cData && cData.approval_status) {
              approvalStatus = cData.approval_status as ApprovalStatus;
            }
          }
        } catch (e) {
          console.warn('[Firebase Auth Store] Error resolving profile from Supabase:', e);
        }
      }

      await safeStorage.setItem(ROLE_KEY, resolvedRole);
      await safeStorage.setItem(AUTH_KEY, 'true');
      await safeStorage.setItem(USER_KEY, name);
      await safeStorage.setItem(APPROVAL_STATUS_KEY, approvalStatus);
      if (avatar) {
        await safeStorage.setItem(AVATAR_KEY, avatar);
      } else {
        await safeStorage.removeItem(AVATAR_KEY);
      }
    } else {
      const localAuth = await safeStorage.getItem(AUTH_KEY);
      if (localAuth !== 'true') {
        await safeStorage.removeItem(ROLE_KEY);
        await safeStorage.removeItem(AUTH_KEY);
        await safeStorage.removeItem(USER_KEY);
        await safeStorage.removeItem(AVATAR_KEY);
        await safeStorage.removeItem(ANON_ID_KEY);
        await safeStorage.removeItem(APPROVAL_STATUS_KEY);
      }
    }
    authResolved = true;
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
  getUserId: async (): Promise<string> => {
    if (hasFirebaseConfig && auth?.currentUser?.uid) {
      return auth.currentUser.uid;
    }
    const role = (await safeStorage.getItem(ROLE_KEY)) as UserRole | null;
    return role === 'counselor' ? 'kwame-boateng' : 'student-user';
  },
  isAuthenticated: async (): Promise<boolean> => {
    const localAuth = await safeStorage.getItem(AUTH_KEY);
    if (localAuth === 'true') {
      return true;
    }
    const client = auth;
    if (hasFirebaseConfig && client) {
      if (!authResolved) {
        await new Promise<void>((resolve) => {
          const unsub = client.onAuthStateChanged(() => {
            unsub();
            resolve();
          });
        });
      }
      return client.currentUser !== null;
    }
    return false;
  },
  getUserName: async (): Promise<string> => {
    if (hasFirebaseConfig && auth?.currentUser) {
      return (
        (await safeStorage.getItem(USER_KEY)) ||
        auth.currentUser.displayName ||
        auth.currentUser.email ||
        'User'
      );
    }
    return (await safeStorage.getItem(USER_KEY)) || 'Guest';
  },
  getAvatarUrl: async (): Promise<string | null> => {
    if (hasFirebaseConfig && auth?.currentUser) {
      return (await safeStorage.getItem(AVATAR_KEY)) || auth.currentUser.photoURL || null;
    }
    return (await safeStorage.getItem(AVATAR_KEY)) || null;
  },
  getAnonymousId: async (): Promise<string | null> => {
    return (await safeStorage.getItem(ANON_ID_KEY)) || null;
  },
  getApprovalStatus: async (): Promise<ApprovalStatus> => {
    const status = await safeStorage.getItem(APPROVAL_STATUS_KEY);
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
      return status;
    }
    return 'approved';
  },
  login: async (
    role: UserRole,
    email: string,
    name?: string,
    avatarUrl?: string,
    anonymousId?: string,
    approvalStatus: ApprovalStatus = 'approved'
  ) => {
    const userName = name || (role === 'student' ? 'Adjoa D.' : 'Kwame Boateng');
    const userAvatar =
      avatarUrl ||
      (role === 'student' ? null : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150');
    await safeStorage.setItem(ROLE_KEY, role);
    await safeStorage.setItem(AUTH_KEY, 'true');
    await safeStorage.setItem(USER_KEY, userName);
    await safeStorage.setItem(APPROVAL_STATUS_KEY, approvalStatus);
    if (userAvatar) {
      await safeStorage.setItem(AVATAR_KEY, userAvatar);
    } else {
      await safeStorage.removeItem(AVATAR_KEY);
    }
    if (anonymousId) {
      await safeStorage.setItem(ANON_ID_KEY, anonymousId);
    }
    notifyListeners();
  },
  updateProfileName: async (name: string) => {
    await safeStorage.setItem(USER_KEY, name);
    notifyListeners();
  },
  updateProfile: async (name: string, avatarUrl: string | null) => {
    await safeStorage.setItem(USER_KEY, name);
    if (avatarUrl) {
      await safeStorage.setItem(AVATAR_KEY, avatarUrl);
    } else {
      await safeStorage.removeItem(AVATAR_KEY);
    }
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
    await safeStorage.removeItem(AVATAR_KEY);
    await safeStorage.removeItem(ANON_ID_KEY);
    await safeStorage.removeItem(APPROVAL_STATUS_KEY);
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('approved');

  useEffect(() => {
    let active = true;
    async function load() {
      const isAuthed = await mockAuth.isAuthenticated();
      const userRole = await mockAuth.getRole();
      const name = await mockAuth.getUserName();
      const avatar = await mockAuth.getAvatarUrl();
      const anonId = await mockAuth.getAnonymousId();
      const status = await mockAuth.getApprovalStatus();
      if (active) {
        setIsAuthenticated(isAuthed);
        setRole(userRole);
        setUserName(name);
        setAvatarUrl(avatar);
        setAnonymousId(anonId);
        setApprovalStatus(status);
      }
    }
    load();
    const unsub = mockAuth.subscribe(load);
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return {
    isAuthenticated,
    role,
    userName,
    avatarUrl,
    anonymousId,
    approvalStatus,
    login: mockAuth.login,
    logout: mockAuth.logout,
    updateProfileName: mockAuth.updateProfileName,
    updateProfile: mockAuth.updateProfile,
  };
}
