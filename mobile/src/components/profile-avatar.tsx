import { View } from 'react-native';
import { Text } from './ui/text';

/** Initial on a coloured circle — instant identity without photos. */
export function ProfileAvatar({
  name,
  color,
  size = 48,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <Text className="font-serif-bold text-white" style={{ fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
