import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScreenSize } from '@/hooks/use-screen-size';
import { useSetCompanion } from '@/api/profiles';
import { useToday } from '@/api/today';
import { CatFace } from '@/components/companion/cat-face';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { useToast } from '@/store/toast';
import type { CompanionMood } from '@/types/companion';
import { localDate } from '@/utils/date';

/** How Mochi works, one rule per slide, each shown with the face she'd make. */
const SLIDES: { mood: CompanionMood; title: string; body: string }[] = [
  {
    mood: 'happy',
    title: 'Meet Mochi',
    body: 'She’ll live on your dashboard and keep you company.',
  },
  { mood: 'happy', title: 'Make her happy', body: 'Finish your daily challenges and she purrs.' },
  {
    mood: 'normal',
    title: 'She hates idle days',
    body: 'No challenges taken? She’s not impressed.',
  },
  {
    mood: 'sad',
    title: 'Miss a day, she cries',
    body: 'Break your streak and she cries the next morning.',
  },
  {
    mood: 'left',
    title: '3 missed days, she leaves',
    body: 'Miss three days in a row and she packs her bags.',
  },
];
const LAST = SLIDES.length; // the decision step comes after the rules

/**
 * Adopting Mochi: swipe through how she works, then decide. Reaching the end is remembered
 * (returning users land on the decision), and choosing closes the page.
 */
export default function AdoptScreen() {
  const { width } = useScreenSize();
  const toast = useToast((s) => s.show);
  const today = useToday(localDate());
  const setCompanion = useSetCompanion();
  const companion = today.data?.companion;
  const startAtEnd = Boolean(companion?.introSeen);
  const [page, setPage] = useState(startAtEnd ? LAST : 0);
  const list = useRef<FlatList>(null);
  const markedSeen = useRef(startAtEnd);

  // Reaching the decision step counts as "seen": next time we skip straight to it.
  useEffect(() => {
    if (page !== LAST || markedSeen.current) return;
    markedSeen.current = true;
    setCompanion.mutate({ introSeen: true });
  }, [page, setCompanion]);

  const goTo = (i: number) => {
    list.current?.scrollToIndex({ index: i, animated: true });
    setPage(i);
  };

  const decide = (status: 'adopted' | 'declined') =>
    setCompanion.mutate(
      { status, introSeen: true },
      {
        onSuccess: () => {
          Haptics.notificationAsync(
            status === 'adopted'
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          );
          toast(
            status === 'adopted'
              ? 'Mochi is home. Keep her happy!'
              : 'No problem. Adopt her anytime from Profile.',
          );
          router.back();
        },
        onError: (err) => toast(err.message),
      },
    );

  const adopted = companion?.status === 'adopted';
  const pages = [...SLIDES.map((s, i) => ({ key: `s${i}`, ...s })), { key: 'decide' }];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <X size={20} color={colors.ink} />
        </Pressable>
        {/* Progress: one dot per page, the current one stretched. */}
        <View
          className="flex-row gap-1.5"
          accessibilityLabel={`Step ${page + 1} of ${pages.length}`}
        >
          {pages.map((p, i) => (
            <Animated.View
              key={p.key}
              layout={LinearTransition.duration(200)}
              className={cn('h-1.5 rounded-full', i === page ? 'w-5 bg-ink' : 'w-1.5 bg-line')}
            />
          ))}
        </View>
        <Pressable
          onPress={() => goTo(LAST)}
          disabled={page === LAST}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip to the end"
          className={cn('h-10 justify-center px-2', page === LAST && 'opacity-0')}
        >
          <Text className="font-sans-semibold text-sm text-muted">Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={list}
        data={pages}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startAtEnd ? LAST : 0}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) =>
          'mood' in item ? (
            <View style={{ width }} className="flex-1 items-center justify-center px-8">
              <CatFace mood={item.mood} size={Math.min(width * 0.62, 260)} />
              <Heading className="mt-6 text-center text-3xl">{item.title}</Heading>
              <Text className="mt-2 text-center text-muted">{item.body}</Text>
              <Button
                className="mt-10 self-stretch"
                variant="secondary"
                label="Next"
                onPress={() => goTo(index + 1)}
              />
            </View>
          ) : (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ width }}
              className="flex-1 items-center justify-center px-8"
            >
              <CatFace mood="happy" size={Math.min(width * 0.62, 260)} />
              <Heading className="mt-6 text-center text-3xl">
                {adopted ? 'Mochi is yours' : 'Adopt Mochi?'}
              </Heading>
              <Text className="mt-2 text-center text-muted">
                {adopted
                  ? 'Keep your daily challenges going and she stays happy.'
                  : 'Daily challenges keep her happy. She’s counting on you.'}
              </Text>
              <View className="mt-10 gap-2 self-stretch">
                {adopted ? (
                  <>
                    <Button label="Got it" onPress={() => router.back()} />
                    <Button
                      variant="ghost"
                      label="Release Mochi"
                      onPress={() => decide('declined')}
                      disabled={setCompanion.isPending}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      label="Adopt Mochi"
                      onPress={() => decide('adopted')}
                      loading={
                        setCompanion.isPending && setCompanion.variables?.status === 'adopted'
                      }
                    />
                    <Button
                      variant="ghost"
                      label="Not now"
                      onPress={() => decide('declined')}
                      disabled={setCompanion.isPending}
                    />
                  </>
                )}
              </View>
            </Animated.View>
          )
        }
      />
    </SafeAreaView>
  );
}
