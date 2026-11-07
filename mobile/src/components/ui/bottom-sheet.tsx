import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import Animated, { Easing, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { Heading } from './text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// iOS sheet curve (expo-animation skill).
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Mobile bottom sheet (preferred over a centred modal on phones). Built on RN Modal so it works
 * in Expo Go with no extra native module. Closes on backdrop tap, the X, or Android back.
 */
export function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Keyboard-aware, so sheets with text fields keep their button above the keyboard. */}
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-black/30"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          entering={SlideInDown.duration(320).easing(EASE_SHEET)}
          className="rounded-t-3xl bg-card px-6 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          accessibilityViewIsModal
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-line" />
          <View className="mb-5 flex-row items-center justify-between">
            <Heading className="text-2xl">{title}</Heading>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full bg-bg"
            >
              <X size={18} color={colors.ink} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
