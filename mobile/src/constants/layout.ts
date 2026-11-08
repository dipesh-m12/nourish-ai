import { Platform } from 'react-native';

/**
 * The app is designed for phones. In a desktop browser it renders inside a phone-sized frame
 * (an iPhone 14-ish 390×844) instead of stretching across the window.
 */
export const WEB_FRAME = { width: 390, height: 844 } as const;

/** Below this window width the browser is already phone-sized: no frame, fill the window. */
const FRAME_FROM_WIDTH = 500;
const FRAME_MARGIN = 24;

/** The app's screen size for a given window: the window itself, or the frame on desktop web. */
export function screenSize(window: { width: number; height: number }) {
  if (Platform.OS !== 'web' || window.width < FRAME_FROM_WIDTH) {
    return { width: window.width, height: window.height, framed: false };
  }
  return {
    width: WEB_FRAME.width,
    height: Math.min(WEB_FRAME.height, window.height - FRAME_MARGIN * 2),
    framed: true,
  };
}
