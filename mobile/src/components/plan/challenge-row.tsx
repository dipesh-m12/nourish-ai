import * as Haptics from 'expo-haptics';
import {
  Brain,
  Check,
  Footprints,
  GlassWater,
  type LucideIcon,
  Moon,
  Salad,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import type { Challenge, ChallengeCategory } from '@/types/plan';

const CATEGORY_ICON: Record<ChallengeCategory, LucideIcon> = {
  movement: Footprints,
  nutrition: Salad,
  hydration: GlassWater,
  sleep: Moon,
  mindset: Brain,
};

interface Props {
  challenge: Challenge;
  selected: boolean;
  onToggle: () => void;
}

/** One suggested challenge the user can take on. Row highlights on press (no scaling for full-width rows). */
export function ChallengeRow({ challenge, selected, onToggle }: Props) {
  const Icon = CATEGORY_ICON[challenge.category];
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${challenge.title}, ${challenge.target} ${challenge.frequency}. ${challenge.why}`}
      className={cn(
        'flex-row gap-3 rounded-2xl border-2 p-4 active:opacity-80',
        selected ? 'border-primary bg-primary-soft' : 'border-line bg-card',
      )}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg">
        <Icon size={20} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold">{challenge.title}</Text>
        <Text className="mt-0.5 text-sm text-primary-dark">
          {challenge.target} · {challenge.frequency}
        </Text>
        <Text className="mt-1 text-sm text-muted">{challenge.why}</Text>
      </View>
      <View
        className={cn(
          'h-6 w-6 items-center justify-center rounded-md border-2',
          selected ? 'border-primary bg-primary' : 'border-line bg-card',
        )}
      >
        {selected && <Check size={14} strokeWidth={3} color="#fff" />}
      </View>
    </Pressable>
  );
}
