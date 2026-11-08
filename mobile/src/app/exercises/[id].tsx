import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExercise } from '@/api/exercises';
import { useMe } from '@/api/profiles';
import { ActivitySheet } from '@/components/burn/activity-sheet';
import { ExerciseDemo } from '@/components/exercises/exercise-demo';
import { title } from '@/components/exercises/exercise-row';
import { Button } from '@/components/ui/button';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { localDate } from '@/utils/date';

/** One exercise: the movement, what it works, how to do it, and "I did this" to log it. */
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const date = localDate();
  const exercise = useExercise(date, id);
  const { data: me } = useMe();
  const insets = useSafeAreaInsets();
  const [logging, setLogging] = useState(false);
  const e = exercise.data;

  const back = (
    <View className="flex-row items-center px-4 py-2">
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="h-10 w-10 items-center justify-center rounded-full bg-card"
      >
        <ChevronLeft size={22} color={colors.ink} />
      </Pressable>
    </View>
  );

  if (exercise.isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        {back}
        <View className="flex-1 items-center justify-center px-8">
          <Heading className="text-center text-2xl">Can’t load this exercise</Heading>
          <Text className="mt-2 text-center text-muted">{exercise.error.message}</Text>
          <Button
            className="mt-6 self-stretch"
            label="Try again"
            onPress={() => exercise.refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {back}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {!e ? (
          <DetailSkeleton />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(350)}>
              <ExerciseDemo
                images={e.images}
                className="w-full rounded-3xl"
                style={{ aspectRatio: 4 / 3 }}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).duration(350)} className="mt-5">
              <Heading className="text-3xl">{e.name}</Heading>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {[e.category, e.level, e.equipment].filter(Boolean).map((tag) => (
                  <View key={tag} className="rounded-full bg-card px-3 py-1">
                    <Text className="text-sm">{title(tag!)}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).duration(350)} className="mt-6">
              <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
                Works
              </Text>
              <Text className="mt-1.5">
                <Text className="font-sans-semibold">{e.primaryMuscles.map(title).join(', ')}</Text>
                {e.secondaryMuscles.length > 0 && (
                  <Text className="text-muted"> · {e.secondaryMuscles.map(title).join(', ')}</Text>
                )}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).duration(350)} className="mt-6">
              <Text className="mb-3 font-sans-semibold text-sm uppercase tracking-wider text-muted">
                How to
              </Text>
              <View className="gap-3">
                {e.instructions.map((step, i) => (
                  <View key={i} className="flex-row gap-3">
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-primary-soft">
                      <Text className="font-sans-semibold text-xs text-primary">{i + 1}</Text>
                    </View>
                    <Text className="flex-1 leading-6">{step}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>

      {e && (
        <View
          className="border-t border-line bg-bg px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {e.doneToday && (
            <View className="mb-2 flex-row items-center justify-center gap-1.5">
              <Check size={14} color={colors.primary} strokeWidth={3} />
              <Text className="text-sm text-primary">Done today</Text>
            </View>
          )}
          <Button
            label={e.doneToday ? 'Log another round' : 'I did this'}
            onPress={() => setLogging(true)}
          />
        </View>
      )}

      {e && (
        <ActivitySheet
          visible={logging}
          date={date}
          kg={me?.weightKg ?? 70}
          exercise={{ id: e.id, name: e.name, met: e.met }}
          onClose={() => setLogging(false)}
        />
      )}
    </SafeAreaView>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonGroup
      accessible
      accessibilityLabel="Loading exercise"
      accessibilityState={{ busy: true }}
    >
      <View style={{ aspectRatio: 4 / 3 }}>
        <SkeletonBlock className="h-full w-full rounded-3xl" />
      </View>
      <SkeletonBlock className="mt-5 h-8 w-3/4" />
      <View className="mt-3 flex-row gap-2">
        <SkeletonBlock className="h-7 w-20 rounded-full" />
        <SkeletonBlock className="h-7 w-24 rounded-full" />
      </View>
      <SkeletonBlock className="mt-6 h-4 w-1/2" />
      <SkeletonBlock className="mt-6 h-16 w-full" />
    </SkeletonGroup>
  );
}
