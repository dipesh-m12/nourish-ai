import { ImageIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import { Text } from './text';

interface Props {
  /** What artwork goes here — shown only until the real image is added. */
  description: string;
  className?: string;
}

/**
 * Reserved space for artwork that hasn't been made yet.
 * Swap for <Image source={require('@/assets/...')} /> with the same size when ready.
 */
export function ImageSlot({ description, className = '' }: Props) {
  return (
    <View
      className={`items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line bg-card/60 p-4 ${className}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ImageIcon size={24} color={colors.muted} />
      <Text className="text-center text-xs text-muted">{description}</Text>
    </View>
  );
}
