import { HMSSDK, HMSConfig } from '@100mslive/react-native-hms';

/**
 * Resolves a 100ms Auth Token for joining a room.
 * Uses 100ms Room Code API via HMSSDK if roomCode is available,
 * or falls back to environment auth token or room code defaults.
 */
export async function getHmsAuthToken(
  hmsInstance: HMSSDK,
  roomCode?: string,
  userId?: string
): Promise<string> {
  const envToken = process.env.EXPO_PUBLIC_100MS_AUTH_TOKEN;
  if (envToken) {
    console.log('[HMSService] Using EXPO_PUBLIC_100MS_AUTH_TOKEN from environment');
    return envToken;
  }

  const targetRoomCode =
    roomCode || process.env.EXPO_PUBLIC_100MS_ROOM_CODE || 'mindknust-demo-room';

  try {
    console.log('[HMSService] Fetching auth token for room code:', targetRoomCode);
    const token = await hmsInstance.getAuthTokenByRoomCode(targetRoomCode, userId);
    console.log('[HMSService] Successfully fetched auth token via room code');
    return token;
  } catch (error) {
    console.warn('[HMSService] Error fetching token by room code:', error);
    // Fallback placeholder token for local testing
    return `dummy_hms_token_${targetRoomCode}_${userId || 'user'}`;
  }
}

/**
 * Creates an HMSConfig object for joining a room.
 */
export function createHmsConfig(authToken: string, username: string): HMSConfig {
  return new HMSConfig({
    authToken,
    username,
  });
}
