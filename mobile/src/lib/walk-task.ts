import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { PermissionsAndroid, Platform } from 'react-native';
import { colors } from '@/constants/colors';

/**
 * Walk tracking that keeps going when the app is in the background or the screen is off: an
 * Android foreground service (the "Walk in progress" notification) collects GPS fixes and parks
 * them in storage; the walk screen drains and scores them when it's back. Imported once from
 * the root layout, because a task must be defined before the OS can wake it.
 */

export const WALK_TASK = 'nourish-walk';
const FIXES_KEY = 'walk:fixes';

export interface RawFix {
  lng: number;
  lat: number;
  /** Metres; null when the phone didn't say. */
  acc: number | null;
  /** ms since epoch. */
  t: number;
  /** m/s from the GPS itself (Doppler), when the phone gives it. */
  speed?: number | null;
}

// Storage is read-modify-write: one writer at a time (the task and the screen share this module).
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function readFixes(): Promise<RawFix[]> {
  try {
    const raw = await AsyncStorage.getItem(FIXES_KEY);
    return raw ? (JSON.parse(raw) as RawFix[]) : [];
  } catch {
    return [];
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  WALK_TASK,
  async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const fresh: RawFix[] = data.locations.map((l) => ({
      lng: l.coords.longitude,
      lat: l.coords.latitude,
      acc: l.coords.accuracy ?? null,
      t: l.timestamp,
      speed: l.coords.speed ?? null,
    }));
    await locked(async () => {
      // Keep the newest 10 000 (~2¾ h at one a second, < 1 MB): a long walk never grows storage
      // without bound, and the app drains them every second while it's open anyway.
      const all = [...(await readFixes()), ...fresh].slice(-10_000);
      await AsyncStorage.setItem(FIXES_KEY, JSON.stringify(all));
    });
  },
);

/** Takes (and clears) the fixes collected since the last call. */
export function drainFixes(): Promise<RawFix[]> {
  return locked(async () => {
    const all = await readFixes();
    if (all.length) await AsyncStorage.removeItem(FIXES_KEY);
    return all;
  });
}

/**
 * Builds before the foreground-service permission was added can't start one (Android 14 would
 * refuse it), so check the manifest grants it first and fall back to in-app tracking.
 */
async function canRunInBackground() {
  if (Platform.OS !== 'android') return false;
  try {
    const perms = ['android.permission.FOREGROUND_SERVICE'];
    if (Number(Platform.Version) >= 34)
      perms.push('android.permission.FOREGROUND_SERVICE_LOCATION');
    const granted = await Promise.all(
      perms.map((p) =>
        PermissionsAndroid.check(p as Parameters<typeof PermissionsAndroid.check>[0]),
      ),
    );
    return granted.every(Boolean);
  } catch {
    return false;
  }
}

/** Starts background collection. Resolves false when only in-app tracking is possible. */
export async function startBackgroundWalk(): Promise<boolean> {
  if (!(await canRunInBackground())) return false;
  try {
    await drainFixes(); // nothing left over from an older walk
    if (await Location.hasStartedLocationUpdatesAsync(WALK_TASK)) return true;
    await Location.startLocationUpdatesAsync(WALK_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 1,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Walk in progress',
        notificationBody: 'Nourish is tracking your route.',
        notificationColor: colors.primary,
      },
    });
    return true;
  } catch (err) {
    console.warn('[walk] background tracking unavailable:', err);
    return false;
  }
}

export async function stopBackgroundWalk() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(WALK_TASK))
      await Location.stopLocationUpdatesAsync(WALK_TASK);
  } catch {
    // already stopped
  }
}
