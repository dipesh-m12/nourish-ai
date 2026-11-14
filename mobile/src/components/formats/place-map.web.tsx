import { MapPin } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { LngLat } from '@/utils/geo';

/** The native map can't run in a browser; places work in the phone app. */
export function PlaceMap(_props: { place: LngLat | null; locate: boolean }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-primary-soft">
      <MapPin size={28} color={colors.primary} />
      <Text className="text-sm text-muted">Places work in the phone app.</Text>
    </View>
  );
}
