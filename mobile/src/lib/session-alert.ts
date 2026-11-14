import * as Notifications from 'expo-notifications';
import type { TodayChallenge } from '@/types/today';
import { CHANNEL } from './push';

/**
 * A local notification for when a timer ends, so a session finished with the app closed still
 * gets its moment (and a tap opens the challenge, which logs it). Scheduled on the phone, so it
 * works offline. Silently skipped without notification permission.
 */
const ID = 'session-done';

export async function scheduleDoneAlert(challenge: TodayChallenge, minutes: number) {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: `${challenge.tracking.label ?? challenge.title} · done`,
        body: `${minutes} min. Tap to count it.`,
        data: { url: `/dashboard?open=challenge&id=${challenge.id}` },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutes * 60,
        channelId: CHANNEL,
      },
    });
  } catch {
    // no permission: the session still logs when the app is opened
  }
}

export async function cancelDoneAlert() {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
}
