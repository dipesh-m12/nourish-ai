import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { cn } from '@/lib/cn';
import { Text } from './ui/text';

interface Props {
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Delay before tiles appear, so they can follow another animation. */
  delay?: number;
  /** Also show each macro's calories, so it's clear they add up to the daily total. */
  showKcal?: boolean;
}

// Protein and carbs are 4 kcal per gram, fat is 9.
const MACROS = [
  { key: 'proteinG', label: 'Protein', dot: 'bg-primary', kcalPerG: 4 },
  { key: 'carbsG', label: 'Carbs', dot: 'bg-accent', kcalPerG: 4 },
  { key: 'fatG', label: 'Fat', dot: 'bg-[#D99A2B]', kcalPerG: 9 },
] as const;

export function MacroTiles({ delay = 0, showKcal, ...grams }: Props) {
  return (
    <View className="flex-row gap-3">
      {MACROS.map((m, i) => (
        <Animated.View
          key={m.key}
          entering={FadeInUp.delay(delay + i * 90).duration(400)}
          className="flex-1 rounded-2xl bg-card p-4"
        >
          <View className="flex-row items-center gap-1.5">
            <View className={cn('h-2 w-2 rounded-full', m.dot)} />
            <Text className="text-sm text-muted">{m.label}</Text>
          </View>
          <View className="mt-1 flex-row items-start">
            <Text className="font-sans-semibold text-xl">{grams[m.key]} g</Text>
            {showKcal && (
              // Raised "×4"/"×9": kcal per gram, so the maths behind the total is visible.
              <Text
                className="ml-0.5 font-sans-semibold text-[10px] text-muted"
                accessibilityLabel={`${m.kcalPerG} calories per gram`}
              >
                ×{m.kcalPerG}
              </Text>
            )}
          </View>
          {showKcal && (
            <Text className="mt-0.5 text-xs text-muted">= {grams[m.key] * m.kcalPerG} kcal</Text>
          )}
        </Animated.View>
      ))}
    </View>
  );
}
