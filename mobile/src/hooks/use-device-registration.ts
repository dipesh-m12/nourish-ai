import { getCalendars } from 'expo-localization';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { request } from '@/lib/api-client';
import { pushToken } from '@/lib/push';

/**
 * Tells the server, on every open, where the user's clock is (IANA zone, so nudges follow
 * daylight saving and travel), how to reach this device, and that the user is active right now
 * (nudges skip people who are already in the app). Failures are silent: it retries next open.
 */

/** Foregrounding more often than this doesn't need another call. */
const MIN_GAP_MS = 5 * 60 * 1000;

let lastSentAt = 0;
let token: string | null | undefined; // undefined = not asked yet this launch

export function deviceTimezone() {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * After the user opts in to reminders: ask for notification permission (in context, not at app
 * start) and send the new token straight away. Resolves whether pushes can now arrive.
 */
export async function enablePush(): Promise<boolean> {
  token = await pushToken(true);
  lastSentAt = 0;
  await register();
  return token !== null;
}

async function register() {
  if (Date.now() - lastSentAt < MIN_GAP_MS) return;
  lastSentAt = Date.now();
  try {
    if (token === undefined) token = await pushToken();
    await request('/me/device', {
      method: 'PUT',
      body: { timezone: deviceTimezone(), pushToken: token },
    });
  } catch {
    lastSentAt = 0; // try again on the next foreground
  }
}

/** Keyed by the session: signing in as another profile registers again (the token moves to it). */
export function useDeviceRegistration(session: string | null) {
  useEffect(() => {
    if (!session) return;
    lastSentAt = 0;
    void register();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void register();
    });
    return () => sub.remove();
  }, [session]);
}
