import { onlineManager } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSession } from '@/store/session';
import { useUpdateGate } from '@/store/update-gate';
import { API_BASE_URL, API_TIMEOUT_MS } from './api-config';

/** Lets the server refuse builds with known bugs (see the server's app-version rules). */
const BUILD_HEADERS: Record<string, string> = {
  'X-App-Platform': Platform.OS,
  'X-App-Version': Constants.expoConfig?.version ?? '0.0.0',
};

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the request never got a response (offline, timeout, server down). */
    public readonly status: number,
    message: string,
    public readonly kind: 'http' | 'offline' | 'timeout' | 'network' = 'http',
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Overrides API_TIMEOUT_MS for slow endpoints (e.g. AI). */
  timeoutMs?: number;
}

/** Single entry point for every API call: auth header, timeout, offline check, error shape. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Fail fast with a clear message instead of waiting out the timeout.
  if (!onlineManager.isOnline()) {
    throw new ApiError(0, 'You’re offline. Turn on Wi-Fi or mobile data and try again.', 'offline');
  }

  const token = useSession.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...BUILD_HEADERS };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(0, 'This is taking too long. Please try again.', 'timeout');
    }
    // Server down, wrong IP, or the connection dropped mid-request.
    throw new ApiError(
      0,
      'Can’t reach the server. Check your connection and try again.',
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  // Expired, tampered or deleted-profile token: drop it, and the app routes back to the picker.
  if (res.status === 401 && token) await useSession.getState().signOut();

  const data = await res.json().catch(() => null);
  // This build is blocked by the server's kill switch: the app swaps to the update screen.
  if (res.status === 426) {
    useUpdateGate.getState().block({
      message: data?.error?.message ?? 'Please update Nourish AI to keep going.',
      updateUrl: data?.error?.details?.updateUrl ?? null,
    });
  }
  // Unblocked again (rule lowered on the server): any accepted request lifts the update screen.
  if (res.ok && useUpdateGate.getState().required) useUpdateGate.getState().clear();
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Something went wrong');
  return data as T;
}
