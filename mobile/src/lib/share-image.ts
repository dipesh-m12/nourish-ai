import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';

/**
 * Turns a view into a PNG and opens the phone's share sheet (save to gallery, send to a chat).
 *
 * The capture comes back as base64 and is written into the app's own cache folder: view-shot's
 * temp file can land in the *external* cache, which expo-sharing's file provider doesn't cover,
 * so sharing it failed. Static imports on purpose (a lazy import() broke Metro's dev bundle).
 * Resolves an error message, or null when the sheet opened.
 */
export async function shareView(ref: RefObject<unknown>, title: string): Promise<string | null> {
  try {
    if (!ref.current) return 'Nothing to share yet.';
    if (!(await Sharing.isAvailableAsync())) return 'Sharing isn’t available on this phone.';
    const base64 = await captureRef(ref as Parameters<typeof captureRef>[0], {
      format: 'png',
      quality: 1,
      result: 'base64',
    });
    const file = new File(Paths.cache, `nourish-${Date.now()}.png`);
    file.write(base64, { encoding: 'base64' });
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: title });
    return null;
  } catch (err) {
    console.warn('[share]', err);
    return err instanceof Error ? err.message : 'Couldn’t share the picture.';
  }
}
