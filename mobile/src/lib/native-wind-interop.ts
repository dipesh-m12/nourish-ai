import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';

/**
 * NativeWind only styles core RN components out of the box. Third-party components need to be
 * registered, or their `className` is silently dropped (an expo-image with no size renders
 * nothing). Imported once from the root layout, before any screen renders.
 */
cssInterop(Image, { className: 'style' });
