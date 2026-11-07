import { CircleCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useToast } from '@/store/toast';

const VISIBLE_MS = 2500;

/** Brief success confirmation near the bottom (ui-ux-pro-max: never succeed silently). */
export function Toast() {
  const { message, id, hide } = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, id, hide]);

  if (!message) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 items-center px-6"
      style={{ bottom: Math.max(insets.bottom, 16) + 72 }}
    >
      <Animated.View
        key={id}
        entering={FadeInDown.duration(250)}
        exiting={FadeOutDown.duration(200)}
        className="flex-row items-center gap-2 rounded-full bg-ink px-4 py-2.5"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <CircleCheck size={16} color="#fff" />
        <Text className="font-sans-medium text-sm text-white">{message}</Text>
      </Animated.View>
    </View>
  );
}
