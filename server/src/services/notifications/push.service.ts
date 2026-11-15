import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { profiles } from '../../db/schema';

/**
 * Sends through Expo's push service (which talks to FCM with the key uploaded to EAS).
 * A dead token (app uninstalled) is cleared so we stop trying.
 */

const expo = new Expo();

export const isPushToken = (token: string) => Expo.isExpoPushToken(token);

export type PushResult = 'sent' | 'dead_token' | 'failed';

export const pushService = {
  async send(
    profileId: string,
    token: string,
    msg: { title: string; body: string; url: string },
  ): Promise<PushResult> {
    const message: ExpoPushMessage = {
      to: token,
      title: msg.title,
      body: msg.body,
      sound: 'nourish_chime.wav',
      // Must match the app's Android channel (mobile/src/lib/push.ts → CHANNEL): it carries
      // the chime and vibration. Builds without it fall back to the default channel.
      channelId: 'nourish-chime',
      priority: 'high',
      // The app reads `url` when the notification is tapped and opens that screen.
      data: { url: msg.url },
    };

    const [ticket] = await expo.sendPushNotificationsAsync([message]);
    if (ticket?.status === 'ok') return 'sent';

    if (ticket?.details?.error === 'DeviceNotRegistered') {
      await db.update(profiles).set({ pushToken: null }).where(eq(profiles.id, profileId));
      return 'dead_token';
    }
    console.warn('[push] failed:', ticket?.message);
    return 'failed';
  },
};
