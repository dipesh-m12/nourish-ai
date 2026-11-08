import { Image } from 'expo-image';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import { Text } from './ui/text';

interface Props {
  name: string;
  color: string;
  size?: number;
  /** Signed URL from the API (null = no photo). */
  imageUrl?: string | null;
  /** Stable storage key. The signed URL changes every request, so the cache keys on this. */
  imageKey?: string | null;
  /** In Mochi's Club: a small "Club" tag overlapping the bottom edge. */
  club?: boolean;
}

/**
 * Profile photo when there is one, otherwise the initial on a coloured circle.
 * The initial stays underneath, so it shows while the photo loads or if it fails.
 */
export function ProfileAvatar({ name, color, size = 48, imageUrl, imageKey, club }: Props) {
  return (
    <View style={{ width: size, height: size }}>
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
      {club && <ClubTag size={size} />}
    </View>
  );
}

/**
 * The Club tag: a sage pill with a white ring, centred on the avatar's bottom edge (half over
 * the photo or initial). Scales with the avatar so it reads at 44 px and at 88 px.
 */
function ClubTag({ size }: { size: number }) {
  const font = Math.max(8, Math.min(12, Math.round(size * 0.15)));
  return (
    <View
      accessibilityLabel="Mochi's Club member"
      style={{
        position: 'absolute',
        bottom: -Math.round(font * 0.9),
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          backgroundColor: colors.primary,
          borderColor: '#fff',
          borderWidth: Math.max(1.5, size * 0.03),
          borderRadius: 999,
          paddingHorizontal: Math.round(font * 0.6),
          paddingVertical: 1,
        }}
      >
        <Text
          className="font-sans-semibold text-white"
          style={{ fontSize: font, lineHeight: Math.round(font * 1.3), includeFontPadding: false }}
        >
          Club
        </Text>
      </View>
    </View>
  );
}
