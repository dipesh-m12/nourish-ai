import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToday } from '@/api/today';
import { ConfettiBurst } from '@/components/confetti-burst';
import { MochiRoom } from '@/components/companion/mochi-room';
import { Button } from '@/components/ui/button';
import { ShareButton } from '@/components/ui/share-button';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { Heading, Text } from '@/components/ui/text';
import { CATEGORY_THEME } from '@/constants/category-theme';
import { colors } from '@/constants/colors';
import { ROOM_ITEM_NAME, ROOM_ITEMS } from '@/constants/mochi-room';
import { localDate } from '@/utils/date';

/** How many items this device has already celebrated (confetti once per new item). */
const SEEN_KEY = 'mochi-room:seen';

/**
 * Mochi's room: what good weeks have earned so far, and this week's way to the next item.
 * Rewards weeks, not taps (see server companion/room.rules.ts).
 */
export default function MochiScreen() {
  const today = useToday(localDate());
  const reduceMotion = useReducedMotion();
  const c = today.data?.companion;
  const room = c?.room;
  const [celebrate, setCelebrate] = useState(false);
  // What the share icon turns into a picture: the title, the room and this week's line.
  const shot = useRef<ComponentRef<typeof View>>(null);

  // A newly earned item gets one confetti burst on this device.
  const unlocked = room?.unlocked ?? 0;
  useEffect(() => {
    if (!unlocked) return;
    let live = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (!live || Number(seen ?? 0) >= unlocked) return;
        setCelebrate(true);
        return AsyncStorage.setItem(SEEN_KEY, String(unlocked));
      })
      .catch(() => {}); // storage hiccup: skip the confetti
    return () => {
      live = false;
    };
  }, [unlocked]);

  // Not hers yet (or she left): the adopt screen explains and asks.
  if (c && c.status !== 'adopted') return <Redirect href="/adopt" />;

  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(80 * i).duration(350));

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        {room && <ShareButton target={shot} title={`${c!.name}’s room`} />}
      </View>

      <ScrollView contentContainerClassName="px-6 pb-10" showsVerticalScrollIndicator={false}>
        {!c || !room ? (
          <View accessible accessibilityLabel="Loading Mochi's room">
            <SkeletonBlock className="mx-auto mt-2 h-7 w-40" />
            <SkeletonBlock className="mt-6 h-64 w-full rounded-3xl" />
          </View>
        ) : (
          <>
            <View ref={shot} collapsable={false} className="bg-bg pb-2">
              <Animated.View entering={enter(0)}>
                <Heading className="text-center text-2xl">{c.name}’s room</Heading>
                {/* Here the news is the item itself, not an invitation to come and see. */}
                <Text className="mt-1 text-center text-muted">
                  {room.newItem ? `New: ${ROOM_ITEM_NAME[room.newItem]}` : c.line}
                </Text>
              </Animated.View>

              <Animated.View entering={enter(1)} className="mt-6">
                <MochiRoom
                  unlocked={room.unlocked}
                  mood={c.mood ?? 'normal'}
                  newItem={room.newItem}
                />
              </Animated.View>

              <Animated.View entering={enter(2)} className="mt-4">
                <WeekToNext full={room.full} need={room.need} unlocked={room.unlocked} />
              </Animated.View>
            </View>

            <Button
              className="mt-6"
              variant="ghost"
              label={`${c.name}’s rules`}
              onPress={() => router.push('/adopt')}
            />
          </>
        )}
      </ScrollView>

      {celebrate && <ConfettiBurst onFinish={() => setCelebrate(false)} />}
    </SafeAreaView>
  );
}

/** This week's full days as segments, and what they earn. */
function WeekToNext({ full, need, unlocked }: { full: number; need: number; unlocked: number }) {
  const next = ROOM_ITEMS[unlocked];
  const theme = CATEGORY_THEME.movement;
  if (!next) {
    return <Text className="text-center font-sans-semibold">Her room is complete.</Text>;
  }
  const earned = full >= need;
  const line = earned
    ? `This week counts: ${ROOM_ITEM_NAME[next]} arrives Monday.`
    : `${full} of ${need} full days this week for ${ROOM_ITEM_NAME[next]}.`;
  return (
    <View
      className="rounded-3xl bg-card p-4"
      accessible
      accessibilityLabel={`${line} A full day is every daily challenge done.`}
    >
      <View className="flex-row gap-1.5">
        {Array.from({ length: need }, (_, i) => (
          <View
            key={i}
            className="h-2 flex-1 rounded-full"
            style={{ backgroundColor: i < full ? theme.mark : theme.track }}
          />
        ))}
      </View>
      <Text className="mt-3 text-sm">{line}</Text>
    </View>
  );
}
