import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { ExerciseSummary } from '@/types/exercise';

export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One exercise: photo, name, what it works. A sage tick once it's done today. */
export function ExerciseRow({
  exercise: e,
  large,
}: {
  exercise: ExerciseSummary;
  large?: boolean;
}) {
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: e.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${e.name}, ${e.category}, ${e.level}${e.doneToday ? ', done today' : ''}`}
      className="flex-row items-center gap-3 rounded-2xl bg-card p-3"
    >
      <View>
        <Image
          source={e.image ? { uri: e.image } : undefined}
          className={cn('rounded-xl bg-bg', large ? 'h-20 w-20' : 'h-14 w-14')}
          contentFit="cover"
          transition={200}
        />
        {e.doneToday && (
          <View className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-primary">
            <Check size={12} color="#fff" strokeWidth={3} />
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold" numberOfLines={2}>
          {e.name}
        </Text>
        <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
          {title(e.primaryMuscles[0] ?? e.category)} · {title(e.level)}
        </Text>
      </View>
    </PressableScale>
  );
}
