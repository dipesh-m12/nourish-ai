import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import type { TodayChallenge } from '@/types/today';
import { localDate } from '@/utils/date';
import { API_BASE_URL } from './api-config';
import { CHANNEL, CHIME, ensureChannel } from './push';
import { tokenStorage } from './token-storage';

/**
 * Automatic check-in at a pinned place (gym, park) with the app closed: Android geofences wake
 * this task on arrival, which logs the challenge and says so in a notification. Opt-in from
 * the place screen, because it needs "Allow all the time" location. Defined at startup from the
 * root layout; the OS may run it with no screen open, so it reads the token itself.
 */

export const PLACE_TASK = 'nourish-place';
const AUTO_KEY = 'place:auto';
const doneKey = (id: string, date: string) => `place:checked:${id}:${date}`;

/** The regions to watch: one per challenge with a pinned spot. */
type Region = Location.LocationRegion & { identifier: string };

TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Region }>(
  PLACE_TASK,
  async ({ data, error }) => {
    if (error || data?.eventType !== Location.GeofencingEventType.Enter) return;
    const id = data.region.identifier;
    const date = localDate();
    // Walking in and out of the edge fires more than once: one check-in a day is plenty.
    if (await AsyncStorage.getItem(doneKey(id, date))) return;
    const token = await tokenStorage.get();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/me/challenges/${id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date, source: 'place' }),
      });
      if (!res.ok) return;
      await AsyncStorage.setItem(doneKey(id, date), '1');
      const name = (data.region as Region & { title?: string }).title;
      // This can run with the app closed, in a fresh process: the channel must exist first.
      await ensureChannel();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'You showed up',
          body: `Checked in${name ? ` at ${name}` : ''}. Nicely done.`,
          data: { url: `/place?id=${id}` },
          sound: CHIME,
        },
        trigger: { channelId: CHANNEL },
      });
    } catch {
      // offline: the place screen still checks in by hand
    }
  },
);

export async function autoCheckInOn() {
  return (await AsyncStorage.getItem(AUTO_KEY).catch(() => null)) === '1';
}

/**
 * Turns auto check-in on: asks for "Allow all the time" (Android sends the user to settings for
 * it). Resolves whether it's on.
 */
export async function enableAutoCheckIn(challenges: TodayChallenge[]): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return false;
    await AsyncStorage.setItem(AUTO_KEY, '1');
    await syncGeofences(challenges);
    return true;
  } catch {
    return false;
  }
}

export async function disableAutoCheckIn() {
  await AsyncStorage.removeItem(AUTO_KEY).catch(() => undefined);
  await syncGeofences([]);
}

/** Keeps the watched regions in step with today's pinned places. Never prompts. */
export async function syncGeofences(challenges: TodayChallenge[]) {
  try {
    const on = await autoCheckInOn();
    const regions = on
      ? challenges
          .filter((c) => c.place && !c.progress.done)
          .map((c) => ({
            identifier: c.id,
            latitude: c.place!.lat,
            longitude: c.place!.lng,
            radius: Math.max(100, c.place!.radiusM),
            notifyOnEnter: true,
            notifyOnExit: false,
          }))
      : [];
    const started = await Location.hasStartedGeofencingAsync(PLACE_TASK);
    if (!regions.length) {
      if (started) await Location.stopGeofencingAsync(PLACE_TASK);
      return;
    }
    if (!(await Location.getBackgroundPermissionsAsync()).granted) return;
    await Location.startGeofencingAsync(PLACE_TASK, regions);
  } catch {
    // geofencing unavailable: in-app check-in still works
  }
}
