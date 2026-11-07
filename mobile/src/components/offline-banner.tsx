import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useIsOnline } from '@/hooks/use-is-online';

/**
 * App-wide notice that slides down when the internet drops and away when it's back.
 * It doesn't block the screen: cached data stays usable, and queries resume on their own.
 */
export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;

  return (
    <Animated.View
      entering={SlideInUp.duration(250)}
      exiting={SlideOutUp.duration(200)}
      className="absolute left-0 right-0 top-0 z-50 bg-ink px-5 pb-3"
      style={{ paddingTop: insets.top + 8 }}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View className="flex-row items-center gap-3">
        <WifiOff size={18} color="#fff" />
        <View className="flex-1">
          <Text className="font-sans-semibold text-sm text-white">You’re offline</Text>
          <Text className="text-xs text-white/80">
            Turn on Wi-Fi or mobile data. We’ll reconnect automatically.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
