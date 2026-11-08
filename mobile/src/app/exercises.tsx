import { router } from 'expo-router';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExerciseFilters, useExercises, useForYou } from '@/api/exercises';
import { ExerciseRow, title } from '@/components/exercises/exercise-row';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { localDate } from '@/utils/date';

/**
 * The exercise library: three picks for today up top, then search and categories over the
 * whole library. Logging happens on each exercise's page.
 */
export default function ExercisesScreen() {
  const date = localDate();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const q = useDebouncedValue(text.trim(), 300);
  const list = useExercises(date, q, category);
  const forYou = useForYou(date);
  const filters = useExerciseFilters();
  const browsing = !q && !category;

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  const header = (
    <View>
      <Heading className="text-3xl">Exercises</Heading>
      <Text className="mt-1 text-muted">Do one, snap it, and it counts toward today’s burn.</Text>

      <View className="mt-5 h-14 flex-row items-center gap-3 rounded-2xl bg-card px-4">
        <Search size={20} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search squats, chest, stretch…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          accessibilityLabel="Search exercises"
          className="flex-1 font-sans text-base text-ink"
        />
        {text.length > 0 && (
          <Pressable
            onPress={() => setText('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mt-3"
        contentContainerClassName="gap-2 px-5"
      >
        {[null, ...(filters.data?.categories.map((c) => c.value) ?? [])].map((c) => {
          const selected = c === category;
          return (
            <PressableScale
              key={c ?? 'all'}
              onPress={() => setCategory(c)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={c ? title(c) : 'All exercises'}
              className={cn(
                'h-9 justify-center rounded-full border px-4',
                selected ? 'border-ink bg-ink' : 'border-line bg-card',
              )}
            >
              <Text
                className={cn('font-sans-semibold text-sm', selected ? 'text-white' : 'text-ink')}
              >
                {c ? title(c) : 'All'}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {browsing && forYou.data && forYou.data.items.length > 0 && (
        <Animated.View entering={FadeInDown.duration(350)} className="mt-6">
          <View className="mb-3 flex-row items-end justify-between">
            <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
              For you today
            </Text>
            <Text className="text-sm">
              {forYou.data.done} of {forYou.data.items.length} done
            </Text>
          </View>
          <View className="gap-2">
            {forYou.data.items.map((e, i) => (
              <Animated.View key={e.id} entering={FadeInDown.delay(i * 70).duration(350)}>
                <ExerciseRow exercise={e} large />
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}

      <Text className="mb-3 mt-8 font-sans-semibold text-sm uppercase tracking-wider text-muted">
        {browsing ? 'All exercises' : `${total} found`}
      </Text>

      {list.isPending && <ListSkeleton />}
      {list.isError && !items.length && (
        <View className="items-center gap-3 rounded-2xl bg-card p-5">
          <Text className="text-center text-muted">{list.error.message}</Text>
          <Button variant="secondary" label="Try again" onPress={() => list.refetch()} />
        </View>
      )}
      {list.isSuccess && !items.length && (
        <View className="items-center rounded-2xl bg-card p-6">
          <Text className="font-sans-semibold">Nothing matches “{q}”</Text>
          <Text className="mt-1 text-sm text-muted">Try a muscle, like “legs” or “chest”.</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
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

      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <ExerciseRow exercise={item} />}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerClassName="px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator className="mt-4" color={colors.primary} />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

function ListSkeleton() {
  return (
    <SkeletonGroup
      className="gap-2"
      accessible
      accessibilityLabel="Loading exercises"
      accessibilityState={{ busy: true }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="flex-row items-center gap-3 rounded-2xl bg-card p-3">
          <SkeletonBlock className="h-14 w-14 rounded-xl" />
          <View className="flex-1 gap-2">
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-3 w-1/3" />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}
