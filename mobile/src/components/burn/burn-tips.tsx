import { Lightbulb } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { previewKcal } from '@/constants/activities';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';

const ROTATE_MS = 6000;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Tips with the user's own numbers in them, so "you burn calories breathing" lands as a fact. */
function tipsFor(restingPerHour: number, kg: number) {
  return [
    `Just breathing and keeping warm, your body burns about ${restingPerHour} kcal every hour.`,
    `Sleep counts too: a 7-hour night burns about ${Math.round(0.95 * kg * 7)} kcal.`,
    `A 20-minute brisk walk adds about ${previewKcal(4.3, 20, kg)} kcal on top.`,
    `10 minutes on the stairs burns about ${previewKcal(8, 10, kg)} kcal. Skip the lift.`,
    `Standing instead of sitting for an hour adds about ${previewKcal(1.8, 60, kg)} kcal.`,
    'Muscle burns more than fat even at rest, so strength work pays off all day.',
  ];
}

/** One tip at a time, crossfading every few seconds. Tap to skip ahead. */
export function BurnTips({ restingPerHour, kg }: { restingPerHour: number; kg: number }) {
  const tips = tipsFor(restingPerHour, kg);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % tips.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [tips.length]);

  return (
    <Pressable
      onPress={() => setIndex((i) => (i + 1) % tips.length)}
      accessibilityRole="button"
      accessibilityLabel={`Tip: ${tips[index]} Tap for the next tip.`}
      className="flex-row items-start gap-3 rounded-2xl bg-primary-soft p-4 active:opacity-80"
    >
      <Lightbulb size={18} color={colors.primary} />
      <View className="min-h-10 flex-1 justify-center">
        <Animated.View
          key={index}
          entering={FadeIn.duration(320).easing(EASE_OUT)}
          exiting={FadeOut.duration(160)}
        >
          <Text className="text-sm leading-5">{tips[index]}</Text>
        </Animated.View>
        <View className="mt-2 flex-row gap-1">
          {tips.map((t, i) => (
            <View
              key={t}
              className={cn(
                'h-1 rounded-full',
                i === index ? 'w-4 bg-primary' : 'w-1 bg-primary/30',
              )}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
}
