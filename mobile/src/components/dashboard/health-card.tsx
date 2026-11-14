import { Activity } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';

/** One ask, shown only while a step or sleep challenge is running and access isn't given. */
export function HealthCard({ onAllow }: { onAllow: () => void }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOut.duration(200)}
      className="mb-3 flex-row items-center gap-3 rounded-3xl bg-card p-4"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
        <Activity size={20} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold">Fill steps and sleep for me</Text>
      </View>
      <PressableScale
        onPress={onAllow}
        accessibilityRole="button"
        accessibilityLabel="Allow Health Connect"
        className="h-10 justify-center rounded-full bg-ink px-4"
      >
        <Text className="font-sans-semibold text-sm text-white">Allow</Text>
      </PressableScale>
    </Animated.View>
  );
}
