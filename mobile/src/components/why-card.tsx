import { Quote } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import { Text } from './ui/text';

/** The user's own reason, quoted back. Shown wherever motivation matters. */
export function WhyCard({ why }: { why: string }) {
  return (
    <View className="rounded-2xl bg-accent-soft p-5">
      <View className="flex-row items-center gap-2">
        <Quote size={16} color={colors.accent} />
        <Text className="font-sans-semibold text-sm uppercase tracking-wider text-accent">
          Your why
        </Text>
      </View>
      <Text className="mt-2 font-serif text-xl leading-snug">{why}</Text>
    </View>
  );
}
