import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Central API configuration. Change timeouts and the base URL here, not in individual calls.
 */

/** Default for every request. Long enough for a slow mobile network, short enough to not hang. */
export const API_TIMEOUT_MS = 15_000;

/**
 * Plan generation calls AI providers server-side (Gemini up to 15 s, then the Groq fallback),
 * so it legitimately needs longer than a normal request.
 */
export const AI_TIMEOUT_MS = 45_000;

/**
 * In development the phone reaches the API on the same machine that serves Metro,
 * so we reuse Expo's host IP. EXPO_PUBLIC_API_URL overrides it (e.g. a deployed API).
 */
function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:4000/api`;
  return 'http://localhost:4000/api';
}

export const API_BASE_URL = resolveBaseUrl();
