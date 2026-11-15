import { MapPin } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { LngLat } from '@/utils/geo';

/** The native map can't run in a browser: time and distance still track, the map is app-only. */
export function WalkMap(_props: { path: LngLat[]; locate: boolean; live: boolean }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-primary-soft">
      <MapPin size={28} color={colors.primary} />
      <Text className="text-sm text-muted">The live map is in the phone app.</Text>
    </View>
  );
}
