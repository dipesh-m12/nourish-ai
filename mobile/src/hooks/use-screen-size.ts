import { useWindowDimensions } from 'react-native';
import { screenSize } from '@/constants/layout';

/**
 * Size of the app's screen: the window on phones, the phone frame on desktop web. Use this (not
 * useWindowDimensions) for anything sized from the screen: carousels, slides, sheet heights.
 */
export function useScreenSize() {
  return screenSize(useWindowDimensions());
}
