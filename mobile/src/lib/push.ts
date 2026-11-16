import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, useRootNavigationState, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { colors } from '@/constants/colors';

/**
 * Push on Android (the web build uses push.web.ts). The server decides when to nudge; this file
 * only gets a token, shows nudges that arrive while the app is open, and opens the screen a
 * tapped nudge points to (`data.url`, e.g. "/dashboard?open=meal").
 */

// Nudges that arrive while the app is open still show as a banner, with their sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Android channel for every reminder and nudge, with Nourish's own chime (bundled by the
 * expo-notifications plugin from assets/sounds, see app.json). Android fixes a channel's sound
 * when it's first created, so a new sound needs a new id; older channels are deleted. The
 * server sends to the same id (push.service.ts).
 */
export const CHANNEL = 'nourish-chime-2';
/** The bundled file's name (Android raw resource: lowercase, underscores). */
export const CHIME = 'nourish_chime.wav';
// 'nourish-chime' was made by builds whose shrinker dropped the sound: stuck on the default.
const OLD_CHANNELS = ['nudges', 'nourish-alerts', 'nourish-reminders', 'nourish-chime'];

let channelReady: Promise<void> | null = null;

/**
 * Makes sure the chime channel exists. Anything posted to a channel that doesn't exist yet goes
 * to Android's fallback channel with the DEFAULT sound: a push right after install, a timer or
 * check-in alert before the app had registered for push. So it runs at app start and before
 * every local notification (once per process; Android keeps an existing channel as it is).
 */
export function ensureChannel(): Promise<void> {
  channelReady ??= (async () => {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Reminders and nudges',
        importance: AndroidImportance.HIGH,
        sound: CHIME,
        enableVibrate: true,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: colors.primary,
      });
      for (const old of OLD_CHANNELS)
        await Notifications.deleteNotificationChannelAsync(old).catch(() => undefined);
    } catch (err) {
      channelReady = null; // try again next time
      console.warn('[push] channel:', err instanceof Error ? err.message : err);
    }
  })();
  return channelReady;
}

/**
 * The Expo push token, or null. `ask` shows the system permission prompt; without it, a token is
 * returned only if permission was already given (so app start never ambushes the user).
 */
export async function pushToken(ask = false): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    await ensureChannel();

    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined' && ask)
      ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn('[push] no token:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Screens a nudge may open. Anything else (old or malformed links) goes to the dashboard. */
const ROUTES = [
  '/dashboard',
  '/week',
  '/place',
  '/walk',
  '/reminders',
  '/assistant',
  '/exercises',
  '/trophy/',
  '/profile',
];
/** Lets the first screen (index → dashboard redirect) settle before we navigate on top. */
const SETTLE_MS = 350;

function urlOf(response: Notifications.NotificationResponse) {
  const url = response.notification.request.content.data?.url;
  if (typeof url !== 'string' || !url.startsWith('/')) return '/dashboard';
  return ROUTES.some(
    (r) => url === r || url.startsWith(r.endsWith('/') ? r : `${r}?`) || url.startsWith(`${r}/`),
  )
    ? url
    : '/dashboard';
}

function open(response: Notifications.NotificationResponse) {
  try {
    // navigate, not push: if that screen is already open it gets the new params instead of a copy.
    router.navigate(urlOf(response) as Href);
  } catch (err) {
    console.warn('[push] could not open', err);
    try {
      router.navigate('/dashboard');
    } catch {
      // nothing more to do: the app stays where it is
    }
  }
}

/**
 * Opens the screen a tapped nudge points to, on a cold start and while the app is running.
 * A tap can launch the app from closed: navigating before the root navigator has mounted (or
 * while the first redirect is still running) throws, so this waits for the navigator to be
 * ready, lets the first screen settle, handles each tap once, and never lets a bad link crash.
 */
export function useNotificationRouting(enabled: boolean) {
  const last = Notifications.useLastNotificationResponse();
  const navReady = Boolean(useRootNavigationState()?.key);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !navReady || !last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const timer = setTimeout(() => {
      open(last);
      // Handled once: don't reopen it on the next render or app launch.
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [enabled, navReady, last]);
}
