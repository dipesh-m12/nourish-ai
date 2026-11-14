import { startActivityAsync } from 'expo-intent-launcher';

/**
 * Opens the phone's Clock app with an alarm already filled in (Android SET_ALARM intent), so
 * a morning walk gets a real alarm the user owns. The user confirms it in the Clock app.
 * Resolves false if no Clock app takes the intent.
 */
export async function setPhoneAlarm(hour: number, minute: number, label: string): Promise<boolean> {
  try {
    await startActivityAsync('android.intent.action.SET_ALARM', {
      extra: {
        'android.intent.extra.alarm.HOUR': hour,
        'android.intent.extra.alarm.MINUTES': minute,
        'android.intent.extra.alarm.MESSAGE': label,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export const ALARM_SUPPORTED = true;
