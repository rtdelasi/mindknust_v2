import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  // @ts-ignore - only exported from the react-native build of @firebase/auth
  getReactNativePersistence,
} from 'firebase/auth';

import { configuredValue } from '@/lib/env';

const firebaseConfig = {
  apiKey: configuredValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: configuredValue(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: configuredValue(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: configuredValue(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: configuredValue(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: configuredValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

let firebaseApp = null;
let firebaseAuth: Auth | null = null;

if (hasFirebaseConfig) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    if (Platform.OS === 'web') {
      // `getReactNativePersistence` is only present in the react-native build
      // of @firebase/auth. On web the package resolves to its browser build,
      // where that export is undefined — calling it throws and would leave
      // `auth` null while `hasFirebaseConfig` stayed true, so every screen's
      // `auth?.currentUser?.uid || 'student-user'` fallback would silently
      // query the database as a user that does not exist.
      firebaseAuth = getAuth(firebaseApp);
      firebaseAuth.setPersistence(indexedDBLocalPersistence).catch(() => {
        firebaseAuth?.setPersistence(browserLocalPersistence).catch((e) => {
          console.warn('Firebase: could not set web auth persistence:', e);
        });
      });
    } else {
      firebaseAuth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  } catch (error) {
    // Do not fail silently: without `auth`, callers fall back to placeholder
    // user IDs and appear to "lose" all their data.
    console.error(
      '[firebase] Auth initialization FAILED — the app will run unauthenticated ' +
        'and user-scoped queries will return nothing:',
      error
    );
    firebaseAuth = null;
  }
}

/**
 * True when Firebase is configured but `auth` could not be created. Callers can
 * use this to surface a real error instead of silently degrading.
 */
export const firebaseAuthFailed = hasFirebaseConfig && firebaseAuth === null;

export { firebaseApp as app, firebaseAuth as auth };
