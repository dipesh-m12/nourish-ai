import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';
import { Platform } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * NativeWind only styles core RN components out of the box. Third-party components need to be
 * registered, or their `className` is silently dropped (an expo-image with no size renders
 * nothing). Imported once from the root layout, before any screen renders.
 */
cssInterop(Image, { className: 'style' });

// Web only: Reanimated's components drop `className` there (rows stacked instead of side by side,
// padding missing). Phones already style them, so they're left untouched.
if (Platform.OS === 'web') {
  cssInterop(Animated.View, { className: 'style' });
  cssInterop(Animated.Text, { className: 'style' });
  cssInterop(Animated.ScrollView, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  });
}
