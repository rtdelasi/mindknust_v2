import AsyncStorage from '@react-native-async-storage/async-storage';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memoryStore = new Map<string, string>();
let asyncStorageAvailable = true;

async function readFromFallback(key: string): Promise<string | null> {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }

  return memoryStore.get(key) ?? null;
}

async function writeToFallback(key: string, value: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }

  memoryStore.set(key, value);
}

async function removeFromFallback(key: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }

  memoryStore.delete(key);
}

async function readWithFallback(key: string): Promise<string | null> {
  if (asyncStorageAvailable) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      asyncStorageAvailable = false;
    }
  }

  return readFromFallback(key);
}

async function writeWithFallback(key: string, value: string): Promise<void> {
  if (asyncStorageAvailable) {
    try {
      await AsyncStorage.setItem(key, value);
      return;
    } catch {
      asyncStorageAvailable = false;
    }
  }

  await writeToFallback(key, value);
}

async function removeWithFallback(key: string): Promise<void> {
  if (asyncStorageAvailable) {
    try {
      await AsyncStorage.removeItem(key);
      return;
    } catch {
      asyncStorageAvailable = false;
    }
  }

  await removeFromFallback(key);
}

export const safeStorage: StorageLike = {
  getItem: readWithFallback,
  setItem: writeWithFallback,
  removeItem: removeWithFallback,
};
