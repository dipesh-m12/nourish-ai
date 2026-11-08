import { X } from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { ScreenFrame } from '@/components/screen-frame';
import { colors } from '@/constants/colors';
import { useScreenSize } from '@/hooks/use-screen-size';
import { Heading } from './text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Pinned below the scrolling content (e.g. a Save button). */
  footer?: ReactNode;
  children: ReactNode;
}

// Values from the expo-animation skill: iOS sheet curve; finger-driven release uses a spring.
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * Bottom sheet you can drag down to dismiss (by the handle/header, so it never fights the
 * list's own scrolling). Built on Gesture Handler v3 + Reanimated: works in Expo Go.
 */
export function DraggableSheet({ visible, onClose, title, footer, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useScreenSize();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (visible) offset.set(0);
  }, [visible, offset]);

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      offset.set(Math.max(0, e.translationY)); // follow the finger, only downwards
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        offset.set(withTiming(height, { duration: 220 }, () => scheduleOnRN(onClose)));
      } else {
        offset.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, offset.get() / 400) }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Modals render outside the app root, so gestures need their own root here. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* On desktop web, keep the sheet inside the phone frame. */}
        <ScreenFrame>
          {/* Keyboard-aware, so a text field inside keeps itself and the footer visible. */}
          <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
            <Animated.View style={backdropStyle} className="absolute inset-0 bg-black/30">
              <Pressable
                className="flex-1"
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              />
            </Animated.View>

            <Animated.View
              entering={SlideInDown.duration(320).easing(EASE_SHEET)}
              style={[sheetStyle, { maxHeight: height * 0.88 }]}
              className="rounded-t-3xl bg-bg"
              accessibilityViewIsModal
            >
              <GestureDetector gesture={pan}>
                <View className="px-6 pb-3 pt-3">
                  <View className="mb-3 h-1 w-10 self-center rounded-full bg-line" />
                  <View className="flex-row items-center justify-between">
                    <Heading className="text-2xl">{title}</Heading>
                    <Pressable
                      onPress={onClose}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      className="h-9 w-9 items-center justify-center rounded-full bg-card"
                    >
                      <X size={18} color={colors.ink} />
                    </Pressable>
                  </View>
                </View>
              </GestureDetector>

              <ScrollView
                contentContainerClassName="px-6 pb-4"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>

              {footer && (
                <View
                  className="border-t border-line px-6 pt-3"
                  style={{ paddingBottom: Math.max(insets.bottom, 16) }}
                >
                  {footer}
                </View>
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </ScreenFrame>
      </GestureHandlerRootView>
    </Modal>
  );
}
