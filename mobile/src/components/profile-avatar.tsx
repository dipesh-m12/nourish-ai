import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from './ui/text';

interface Props {
  name: string;
  color: string;
  size?: number;
  /** Signed URL from the API (null = no photo). */
  imageUrl?: string | null;
  /** Stable storage key. The signed URL changes every request, so the cache keys on this. */
  imageKey?: string | null;
}

/**
 * Profile photo when there is one, otherwise the initial on a coloured circle.
 * The initial stays underneath, so it shows while the photo loads or if it fails.
 */
export function ProfileAvatar({ name, color, size = 48, imageUrl, imageKey }: Props) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {/* Line height must follow the font size, or the default (text-base) line clips the
          letter at big sizes. includeFontPadding off keeps Android from pushing it off-centre. */}
      <Text
        className="font-serif-bold text-white"
        style={{
          fontSize: size * 0.42,
          lineHeight: Math.round(size * 0.42 * 1.25),
          includeFontPadding: false,
          textAlignVertical: 'center',
        }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </Text>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl, cacheKey: imageKey ?? undefined }}
          cachePolicy="disk"
          transition={200}
          contentFit="cover"
          style={{ position: 'absolute', width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}
